/* eslint-disable no-debugger */
const io = require('socket.io-client')
window.PIXI = require('phaser/build/custom/pixi')
window.p2 = require('phaser/build/custom/p2')
const Phaser = window.Phaser = require('phaser/build/custom/phaser-split')

const socket = io()
const map = require('./mapGenerator.js').getMap(15, 9)

const game = new Phaser.Game(
  window.innerWidth,
  window.innerHeight,
  Phaser.CANVAS,
  'pottergame',
  { preload, create, update, render }
)

let wizardGroup, bulletGroup, wallGroup, killWallGroup
let cursors, keys
let wizards, bullets, walls
let playerWizards = []
let wizardsByHouse = [[], [], [], []]
let houseNumSprite = {
  0: 'wizred',
  1: 'wizyellow',
  2: 'wizblue',
  3: 'wizgreen'
}
let nextFire
const FIRERATE = 300
const MAXMANA = 100
let shootMana = 25
let startGameDate
let finished = false
let sequence = false

const timer = document.querySelector('#countdown > span')
const gmana = document.querySelector('#slyth')
const bmana = document.querySelector('#raven')
const rmana = document.querySelector('#grif')
const ymana = document.querySelector('#huff')

function getTimeRemaining () {
  let t = Date.parse(new Date()) - startGameDate
  let seconds = Math.floor((t / 1000) % 60)
  return 20 - seconds
}

function endGame () {
  console.log('endgame')
  finished = true
  document.querySelector('#round').style.display = 'flex'

  setTimeout(function () {
    killWallGroup.removeAll(true)
    wizardGroup.removeAll(true)
    bulletGroup.removeAll(true)
    wallGroup.removeAll(true)
    playerWizards = []
    startGameDate = undefined
    finished = false
    rmana.style.width = '100%'
    ymana.style.width = '100%'
    bmana.style.width = '100%'
    gmana.style.width = '100%'
    create()
  }, 5000)
}

function preload () {
  // asset loading stuff goes here
  game.load.image('wizard', 'images/wizardSmall.png')
  game.load.image('wizred', 'images/girlred.png')
  game.load.image('wizgreen', 'images/girlgreen.png')
  game.load.image('wizyellow', 'images/girlyellow.png')
  game.load.image('wizblue', 'images/girlblue.png')
  game.load.image('bullet5', 'images/bolanieve.png')
  game.load.image('wall', 'images/wall.jpg')
}

function createWizard (tx, ty) {
  const wizard = wizardGroup.create(tx * 100, ty * 100, 'wizard')
  wizard.anchor.x = 0.5
  wizard.anchor.y = 0.3
  wizard.body.setSize(60, 60, 20, 0)
  wizard.body.bounce.setTo(0.8, 0.8)
  wizard.body.collideWorldBounds = true
  wizard.mana = MAXMANA
  wizard.alive = true
  wizards.push(wizard)
}

function create () {
  document.querySelector('#round').style.display = 'none'
  game.stage.backgroundColor = '#9f6015'

  sequence = false
  finished = false

  game.physics.startSystem(Phaser.Physics.ARCADE)
  game.physics.arcade.gravity.y = 0
  game.physics.arcade.sortDirection = Phaser.Physics.Arcade.BOTTOM_TOP

  killWallGroup = game.add.group()
  killWallGroup.enableBody = true
  killWallGroup.physicsBodyType = Phaser.Physics.ARCADE

  walls = []
  wallGroup = game.add.group()
  wallGroup.enableBody = true
  wallGroup.physicsBodyType = Phaser.Physics.ARCADE
  for (let i = 0; i < map.length; ++i) {
    for (let j = 0; j < map.length; j++) {
      if (map[i][j]) {
        const wall = wallGroup.create(100 * i, 100 * j, 'wall')
        wall.anchor.x = 0.5
        wall.body.setSize(100, 100, 0, 0)
        wall.body.collideWorldBounds = false
        wall.body.immovable = true
        wall.body.moves = false
        walls.push(wall)
      }
    }
  }

  wizardGroup = game.add.group()
  wizardGroup.enableBody = true
  wizardGroup.physicsBodyType = Phaser.Physics.ARCADE

  wizards = []

  let tx, ty

  for (tx = 0; tx < map.length; tx++) {
    for (ty = 0; ty < map[0].length; ty++) {
      if (map[tx][ty] === 0) break
    }
    if (map[tx][ty] === 0) {
      createWizard(tx, ty)
      break
    }
  }

  for (tx = map.length - 1; tx > 0; tx--) {
    for (ty = 0; ty < map[0].length; ty++) {
      console.log(map[tx])
      if (map[tx][ty] === 0) break
    }
    if (map[tx][ty] === 0) {
      createWizard(tx, ty)
      break
    }
  }

  for (tx = 0; tx < map.length; tx++) {
    for (ty = map[0].length - 1; ty > 0; ty--) {
      if (map[tx][ty] === 0) break
    }
    if (map[tx][ty] === 0) {
      createWizard(tx, ty)
      break
    }
  }

  for (tx = map.length - 1; tx > 0; tx--) {
    for (ty = map[0].length - 1; ty > 0; ty--) {
      if (map[tx][ty] === 0) break
    }
    if (map[tx][ty] === 0) {
      createWizard(tx, ty)
      break
    }
  }

  bullets = []
  bulletGroup = game.add.group()
  bulletGroup.enableBody = true
  bulletGroup.physicsBodyType = Phaser.Physics.ARCADE

  cursors = game.input.keyboard.createCursorKeys()
  keys = {
    up: game.input.keyboard.addKey(Phaser.KeyCode.W),
    left: game.input.keyboard.addKey(Phaser.KeyCode.A),
    down: game.input.keyboard.addKey(Phaser.KeyCode.S),
    right: game.input.keyboard.addKey(Phaser.KeyCode.D)
  }
  game.input.gamepad.start()

  nextFire = game.time.now + FIRERATE
}

const SPEED = 300
const FSPEED = 400

function update () {
  game.physics.arcade.collide(wizardGroup)
  game.physics.arcade.collide(wizardGroup, bulletGroup, bulletCollided)
  game.physics.arcade.collide(killWallGroup, wizardGroup, wallCollided)
  game.physics.arcade.collide(wizardGroup, wallGroup)
  game.physics.arcade.collide(wallGroup, bulletGroup, bulletCollidedWall)

  window.meinWizard = wizards[0]
  if (playerWizards.length === 0) {
    const wizard = wizards[0]
    wizard.body.velocity.x = SPEED * Number(keys.right.isDown) - SPEED * Number(keys.left.isDown)
    wizard.body.velocity.y = SPEED * Number(keys.down.isDown) - SPEED * Number(keys.up.isDown)

    if (game.time.now > nextFire) {
      let fx = Number(cursors.right.isDown) - Number(cursors.left.isDown)
      let fy = Number(cursors.down.isDown) - Number(cursors.up.isDown)
      if ((fx !== 0 || fy !== 0) && wizard.mana >= shootMana) {
        wizard.mana -= shootMana
        updateWizardManaBar(wizard)
        fireBullet(wizard, Number(fx), Number(fy))
        nextFire = game.time.now + FIRERATE
      }
    }
  } else updateAllWizards()

  if (!finished) {
    let t = getTimeRemaining()
    if (t <= 5 && !sequence) {
      sequence = true
      dropSequence(1)
    }
    timer.innerHTML = t + 's'
  }
}

function dropSequence (i) {
  if (i > map.length / 2) return

  for (let k = i; k < map.length - i; ++k) {
    drawBlock(k, i)
    drawBlock(map.length - 1 - i, k)
    drawBlock(k, map[0].length - 1 - i)
    drawBlock(i, k)
  }

  setTimeout(function () {
    dropSequence(i + 1)
  }, 1500)
}

function drawBlock (x, y) {
  const wall = killWallGroup.create(100 * x, 100 * y, 'wall')
  wall.anchor.x = 0.5
  wall.body.setSize(100, 100, 0, 0)
  wall.body.collideWorldBounds = false
  wall.body.immovable = true
  wall.body.moves = false
  // walls.push(wall)
}

function updateWizardManaBar (wizard) {
  if (wizard.house === '0') rmana.style.width = wizard.mana + '%'
  if (wizard.house === '1') ymana.style.width = wizard.mana + '%'
  if (wizard.house === '2') bmana.style.width = wizard.mana + '%'
  if (wizard.house === '3') gmana.style.width = wizard.mana + '%'
  console.log(wizards.map(wizard => wizard.mana).join(','))
}

function updateAllWizards () {
  for (let i = 0; i < playerWizards.length; ++i) {
    let wizard = wizards[i]
    if (wizard.alive) {
      let input = playerWizards[i].input
      moveWizard(wizard, input[0])

      if (game.time.now > nextFire && (input[1][0] || input[1][1]) && wizard.mana >= shootMana) {
        wizard.mana -= shootMana
        updateWizardManaBar(wizard)
        fireBullet(wizard, input[1][0], input[1][1] * -1)
        nextFire = game.time.now + FIRERATE
      }
    }
  }
}

function moveWizard (wizard, vec) {
  wizard.body.velocity.x = SPEED * vec[0]
  wizard.body.velocity.y = SPEED * vec[1] * -1
}

function fireBullet (wizard, x, y) {
  let house = wizard.house
  const bullet = bulletGroup.create(
    wizard.x - 25 + (60 * x), wizard.y - 25 + (60 * y),
    'bullet5'
  )

  if (house === '0') bullet.tint = 0xcd2129
  else if (house === '1') bullet.tint = 0xe7c427
  else if (house === '2') bullet.tint = 0x0b9ed1
  else if (house === '3') bullet.tint = 0x21a047

  console.log(house)

  // bullet.anchor.x = 0.5
  bullet.body.setSize(50, 50, 0, 0)
  bullet.body.collideWorldBounds = true
  bullet.body.velocity.y = FSPEED * y
  bullet.body.velocity.x = FSPEED * x
  bullets.push(bullet)
  let angleRot = 2 * Math.PI / 8
  if (x === 0 && y === 0) wizard.rotation = angleRot * 4
  if (x === 0 && y === 1) wizard.rotation = 0
  if (x === 1 && y === 1) wizard.rotation = angleRot * 7
  if (x === 1 && y === 0) wizard.rotation = angleRot * 6
  if (x === 1 && y === -1) wizard.rotation = angleRot * 5
  if (x === 0 && y === -1) wizard.rotation = angleRot * 4
  if (x === -1 && y === -1) wizard.rotation = angleRot * 3
  if (x === -1 && y === 0) wizard.rotation = angleRot * 2
  if (x === -1 && y === 1) wizard.rotation = angleRot
}

function bulletCollided (wizard, bullet) {
  if (wizard.player) {
    wizard.player.time = getTimeRemaining()
  }
  wizard.alive = false
  wizardGroup.remove(wizard, false)
  bulletGroup.remove(bullet, true)
  console.log('Bullet collided with ' + wizard)
}

function bulletCollidedWall (wall, bullet) {
  bulletGroup.remove(bullet, true)
  console.log('Bullet collided with ' + wall)
}

function wallCollided (wall, wizard) {
  wizard.alive = false
  if (wizard.player) {
    wizard.player.time = getTimeRemaining()
  }
  wizardGroup.remove(wizard, false)
}

function render () {
  // wizards.forEach(wizard => game.debug.body(wizard))
  // bullets.forEach(bullet => game.debug.body(bullet))
  // walls.forEach(wall => game.debug.body(wall))
}

function resize () {
  game.scale.setGameSize(window.innerWidth, window.innerHeight)
  game.scale.refresh()
}

window.onresize = resize

const players = {}

class Player {
  constructor (id, house) {
    this.id = id
    this.house = house
    this.input = [[0, 0], [0, 0]]
    this.time = NaN
  }

  updateInput (input) {
    this.input = input
  }
}

function onPlayerJoin (socketId, house) {
  console.log('player-join', socketId, house)
  const player = new Player(socketId, house)
  players[player.id] = player
  wizardsByHouse[house].push(player)
  console.log(players)
}

function onInputUpdate (socketId, inputData) {
  const player = players[socketId]
  if (!player) return
  player.updateInput(inputData)
}

function onBuff (socketId, buff) {
  console.log('buff!', socketId, buff)
  const player = players[socketId]
  if (!player) return
  const { house } = player
  for (let wizard of wizards) {
    if (wizard.house == house) wizard.mana++
  }
  updateWizardManaBar(wizard)
}

socket.on('connect', () => {
  console.log('socket connected to server')
  socket.emit('host-game')

  socket.on('player-join', onPlayerJoin)
  socket.on('input-update', onInputUpdate)
  socket.on('buff', onBuff)
})

window.startGame = function () {
  const promoted = []

  for (let houseId in wizardsByHouse) {
    let house = wizardsByHouse[houseId]
    if (house.length > 0) {
      let player = house[Math.floor(Math.random() * house.length)]
      console.log('Selected ' + player.id)
      promoted.push(player.id)
      playerWizards.push(player)
      wizards[playerWizards.length - 1].loadTexture(houseNumSprite[player.house], 0)
      wizards[playerWizards.length - 1].house = houseId
      wizards[playerWizards.length - 1].player = player
    }
  }
  socket.emit('promote-players', promoted)
  startGameDate = Date.parse(new Date())
  setTimeout(endGame, 20000)
}
