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

let wizardGroup, cursors, keys, bulletGroup, wallGroup
let wizards, bullets, walls
// let fire = false
// let fireKey
let nextFire
const FIRERATE = 300

function preload () {
  // asset loading stuff goes here
  game.load.image('wizard', 'images/wizardSmall.png')
  game.load.image('bullet5', 'images/bullet.png')
  game.load.image('wall', 'images/wall.jpg')
}

function createWizard (tx, ty) {
  const wizard = wizardGroup.create(tx * 100, ty * 100, 'wizard')
  wizard.anchor.x = 0.5
  wizard.body.setSize(80, 80, 0, 0)
  wizard.body.bounce.setTo(0.8, 0.8)
  wizard.body.collideWorldBounds = true
  wizards.push(wizard)
}

function create () {
  game.stage.backgroundColor = '#9f6015'

  game.physics.startSystem(Phaser.Physics.ARCADE)
  game.physics.arcade.gravity.y = 0
  game.physics.arcade.sortDirection = Phaser.Physics.Arcade.BOTTOM_TOP

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

  // fireKey = game.input.keyboard.addKey(Phaser.KeyCode.SPACEBAR)
  // cursors.isUp.add(function () {
    // fire = true
  // })
}

const SPEED = 200
const FSPEED = 300

function update () {
  game.physics.arcade.collide(wizardGroup)
  game.physics.arcade.collide(wizardGroup, bulletGroup, bulletCollided)
  game.physics.arcade.collide(wizardGroup, wallGroup)
  game.physics.arcade.collide(wallGroup, bulletGroup, bulletCollidedWall)

  const wizard = wizards[0]
  wizard.body.velocity.x = SPEED * Number(keys.right.isDown) - SPEED * Number(keys.left.isDown)
  wizard.body.velocity.y = SPEED * Number(keys.down.isDown) - SPEED * Number(keys.up.isDown)

  if (game.time.now > nextFire) {
    let fx = Number(cursors.right.isDown) - Number(cursors.left.isDown)
    let fy = Number(cursors.down.isDown) - Number(cursors.up.isDown)
    if (fx !== 0 || fy !== 0) {
      fireBullet(wizard, Number(fx), Number(fy))
      nextFire = game.time.now + FIRERATE
    }
  }
}

function fireBullet (wizard, x, y) {
  const bullet = bulletGroup.create(
    wizard.x + 40 * x + (x < 0 ? -30 : 0), wizard.y + 40 + (y < 0 ? 60 : 50) * y,
    'bullet5'
  )
  // bullet.anchor.x = 0.5
  bullet.body.setSize(10, 10, 0, 0)
  bullet.body.collideWorldBounds = true
  bullet.body.velocity.y = FSPEED * y
  bullet.body.velocity.x = FSPEED * x
  bullets.push(bullet)
}

function bulletCollided (wizard, bullet) {
  wizardGroup.remove(wizard, false)
  bulletGroup.remove(bullet, true)
  console.log('Bullet collided with ' + wizard)
}

function bulletCollidedWall (wall, bullet) {
  bulletGroup.remove(bullet, true)
  console.log('Bullet collided with ' + wall)
}

function render () {
  wizards.forEach(wizard => game.debug.body(wizard))
  bullets.forEach(bullet => game.debug.body(bullet))
  walls.forEach(wall => game.debug.body(wall))
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
  }

  updateInput (input) {
    this.input = input
  }
}

function onPlayerJoin (socketId, house) {
  console.log('player-join', socketId, house)
  const player = new Player(socketId, house)
  players[player.id] = player
  console.log(players)
}

function onInputUpdate (socketId, inputData) {
  console.log('input-data', socketId, inputData)
  const player = players[socketId]
  if (!player) return
  player.updateInput = inputData
}

socket.on('connect', () => {
  console.log('socket connected to server')
  socket.emit('host-game')

  socket.on('player-join', onPlayerJoin)
  socket.on('input-update', onInputUpdate)
})

window.startGame = function () {}
