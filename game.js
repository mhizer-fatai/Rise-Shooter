const GAME_WIDTH = window.innerWidth;
const GAME_HEIGHT = window.innerHeight;

let player;
let cursors;
let playerBullets;
let enemies;
let enemyBullets;
let score = 0;
let scoreText;
let health = 200;
let healthText;
let levelThresholds = [150, 250, 350, 500, 750];
let lastEnemySpawnTime = 0;
let enemySpawnInterval = 800;
let enemyFireInterval = 3600 * 1.65;
let lastPlayerShotTime = 0;
let playerShotInterval = 300;
let dragging = false;
let dragStartX = 0;
let phaserScene = null;

const PLAYER_SPEED = 400;
const BULLET_SPEED = 700;
const ENEMY_BULLET_SPEED = 400;

// --- Added for restart functionality ---
let _gameOverText = null;
let _restartBtnBound = false;
// --------------------------------------

let gameplayStarted = false; // renamed from gameStarted to avoid conflict
let levelTransition = false; // <-- added for level transition

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#A020F0',
  physics: {
    default: 'arcade',
    arcade: { debug: false, fps: 120 }
  },
  fps: { target: 75, min: 30 },
  scene: { preload, create, update }
};

// ✅ Prevent auto start — game starts only when startGame() is called
// let game = new Phaser.Game(config);

// ✅ Global function for page.js to call after countdown
window.startGame = function () {
  if (window.gameplayStarted) return;
  window.gameplayStarted = true;
  window.game = new Phaser.Game(config);
};

function preload() {
  this.load.image('player', 'assets/player_ship.png');
  this.load.image('enemy', 'assets/enemy_ship.png');
  this.load.image('playerBullet', 'assets/player_bullet.png');
  this.load.image('enemyBullet', 'assets/enemy_bullet.png');
  this.load.audio('bgMusic', 'assets/bg_music.mp3');
}

function create() {
  phaserScene = this;

  player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 80, 'player');
  player.setCollideWorldBounds(true);

  playerBullets = this.physics.add.group();
  enemies = this.physics.add.group();
  enemyBullets = this.physics.add.group();

  scoreText = this.add.text(GAME_WIDTH - 30, 20, 'Score: 0', { fontSize: '24px', fill: '#fff' }).setOrigin(1, 0);
  healthText = this.add.text(30, 20, 'Health: 200', { fontSize: '24px', fill: '#fff' }).setOrigin(0, 0);

  cursors = this.input.keyboard.createCursorKeys();

  this.input.on('pointerdown', pointer => { dragging = true; dragStartX = pointer.x; });
  this.input.on('pointerup', () => dragging = false);
  this.input.on('pointermove', pointer => {
    if (dragging) {
      const dx = pointer.x - dragStartX;
      player.x += dx;
      dragStartX = pointer.x;
    }
  });

  this.bgMusic = this.sound.add('bgMusic', { loop: true, volume: 0.4 });

  // ✅ Countdown before game starts
  this.scene.pause();
  let countdown = 3;
  const msg = document.getElementById('level-message');
  msg.style.display = 'block';
  msg.innerHTML = `Game starting in ${countdown}...`;
  const interval = setInterval(() => {
    countdown--;
    if (countdown > 0) msg.innerHTML = `Game starting in ${countdown}...`;
    else {
      clearInterval(interval);
      msg.style.display = 'none';
      gameplayStarted = true;
      this.bgMusic.play();
      this.scene.resume();
    }
  }, 1000);

  this.physics.add.overlap(playerBullets, enemies, handlePlayerBulletHit, null, this);
  this.physics.add.overlap(enemyBullets, player, handlePlayerHit, null, this);
  this.physics.add.overlap(playerBullets, enemyBullets, handleBulletCollision, null, this);
}

function update(time, delta) {
  if (!gameplayStarted || levelTransition) return; // pause logic during countdowns

  const deltaSec = delta / 1000;

  // ✅ Level transition trigger
  if (
    checkLevelProgress(
      score,
      levelThresholds,
      function (level) {
        phaserScene.scene.pause();
      },
      function (nextLevel) {
        levelTransition = true;
        showLevelCountdown(nextLevel, () => {
          score = 0;
          health = 200;
          updateScore();
          updateHealth();
          enemies.clear(true, true);
          enemyBullets.clear(true, true);
          playerBullets.clear(true, true);
          player.x = GAME_WIDTH / 2;
          player.y = GAME_HEIGHT - 80;
          let idx = nextLevel - 1;
          enemySpawnInterval = Math.max(350, 800 - idx * 100);
          enemyFireInterval = enemySpawnInterval * 4.5 * 1.65 * Math.pow(1 / 1.15, nextLevel - 1);
          playerShotInterval = 300 * Math.pow(1 / 1.15, nextLevel - 1);
          levelTransition = false;
          phaserScene.scene.resume();
        });
      }
    )
  ) {
    return;
  }

  if (cursors.left.isDown) player.x -= PLAYER_SPEED * deltaSec;
  else if (cursors.right.isDown) player.x += PLAYER_SPEED * deltaSec;
  player.x = Phaser.Math.Clamp(player.x, player.width / 2, GAME_WIDTH - player.width / 2);

  if (time > lastPlayerShotTime + playerShotInterval) {
    shootPlayerBullet(this);
    lastPlayerShotTime = time;
  }

  if (time > lastEnemySpawnTime + enemySpawnInterval) {
    spawnEnemy(this);
    lastEnemySpawnTime = time;
  }

  enemies.children.iterate(enemy => {
    if (!enemy) return;
    if (!enemy.lastShotTime) enemy.lastShotTime = 0;
    if (time > enemy.lastShotTime + enemyFireInterval) {
      shootEnemyBullet(this, enemy);
      enemy.lastShotTime = time;
    }
    enemy.y += enemy.body.velocity.y * deltaSec / (enemy.body.maxSpeed || 1);
    if (enemy.y > GAME_HEIGHT + enemy.height / 2) {
      enemy.destroy();
      health -= 5;
      updateHealth();
      checkGameOver(this);
    }
  });

  playerBullets.children.each(bullet => {
    bullet.y -= BULLET_SPEED * deltaSec;
    if (bullet.y < -50) bullet.destroy();
  });
  enemyBullets.children.each(bullet => {
    bullet.y += ENEMY_BULLET_SPEED * deltaSec;
    if (bullet.y > GAME_HEIGHT + 50) bullet.destroy();
  });
}

function shootPlayerBullet(scene) {
  const bullet = playerBullets.create(player.x, player.y - 30, 'playerBullet');
  bullet.setScale(0.1);
}

function spawnEnemy(scene) {
  const x = Phaser.Math.Between(50, GAME_WIDTH - 50);
  const enemy = enemies.create(x, -40, 'enemy');
  enemy.hp = 2;
  enemy.setScale(0.2);
  enemy.lastShotTime = 0;
  enemy.body.velocity.y = Phaser.Math.Between(140, 220) + getCurrentLevel() * 35;
  enemy.body.maxSpeed = enemy.body.velocity.y;
}

function shootEnemyBullet(scene, enemy) {
  const bullet = enemyBullets.create(enemy.x, enemy.y + 20, 'enemyBullet');
  bullet.setScale(0.1);
}

function handlePlayerBulletHit(bullet, enemy) {
  bullet.destroy();
  enemy.hp--;
  if (enemy.hp <= 0) {
    enemy.destroy();
    score += 5;
    updateScore();
  }
}

function handlePlayerHit(player, bullet) {
  bullet.destroy();
  health -= 10;
  updateHealth();
  checkGameOver(phaserScene);
}

function handleBulletCollision(playerBullet, enemyBullet) {
  playerBullet.destroy();
  enemyBullet.destroy();
}

function updateScore() { scoreText.setText('Score: ' + score); }
function updateHealth() { healthText.setText('Health: ' + health); }

function checkGameOver(scene) {
  if (health <= 0) {
    if (_gameOverText) return;
    _gameOverText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'Game Over', { fontSize: '64px', fill: '#fff' }).setOrigin(0.5);
    scene.scene.pause();
    if (scene.bgMusic) scene.bgMusic.stop();

    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
      restartButton.classList.add('show');
      if (!_restartBtnBound) {
        restartButton.addEventListener('click', () => {
          restartButton.classList.remove('show');
          if (_gameOverText) { _gameOverText.destroy(); _gameOverText = null; }
          restartGame(scene);
        });
        _restartBtnBound = true;
      }
    }
  }
}

function restartGame(scene) {
  score = 0;
  health = 200;
  updateScore();
  updateHealth();
  if (typeof currentLevel !== 'undefined') currentLevel = 1;
  enemies.clear(true, true);
  enemyBullets.clear(true, true);
  playerBullets.clear(true, true);
  player.x = GAME_WIDTH / 2;
  player.y = GAME_HEIGHT - 80;
  lastEnemySpawnTime = 0;
  lastPlayerShotTime = 0;
  enemySpawnInterval = 800;
  enemyFireInterval = 3600 * 1.65;
  playerShotInterval = 300;
  if (scene.bgMusic) scene.bgMusic.play();
  scene.scene.resume();
  gameplayStarted = true; // allow gameplay after restart
}

// ✅ Helper for showing level complete + countdown
function showLevelCountdown(nextLevel, onFinish) {
  const msg = document.getElementById('level-message');
  msg.style.display = 'block';
  let countdown = 3;
  msg.innerHTML = `Level ${nextLevel - 1} Complete!<br>Next level in ${countdown}...`;
  const timer = setInterval(() => {
    countdown--;
    if (countdown > 0)
      msg.innerHTML = `Level ${nextLevel - 1} Complete!<br>Next level in ${countdown}...`;
    else {
      clearInterval(timer);
      msg.style.display = 'none';
      onFinish();
    }
  }, 1000);
}