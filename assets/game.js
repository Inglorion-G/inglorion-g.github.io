(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Game = Asteroids.Game = function (ctx) {
	    this.ctx = ctx;
	    this.asteroids = [];
			this.stars = [];
			this.currentLevel = 1
	    this.addAsteroids();
	    this.bullets = [];

	    var pos = [Asteroids.Game.DIM_X / 2, Asteroids.Game.DIM_Y / 2];
	    var vel = [0, 0];
	    this.ship = new Asteroids.Ship(pos, vel);
    };

    Game.DIM_X = window.innerWidth - 20;
    Game.DIM_Y = window.innerHeight - 20;
    Game.FPS = 60;

    Game.prototype.addAsteroids = function () {
			var astNum = this.currentLevel * 10;
      for (var i = 0; i < astNum; i++) {
				this.asteroids.push(Asteroids.Asteroid.randomAsteroid(Game.DIM_X, Game.DIM_Y));
      }
    };

    Game.prototype.checkCollisions = function () {
	    var ship = this.ship;

	    for (var i = 0; i < this.asteroids.length; i++) {
	      if (this.asteroids[i].isCollidedWith(ship)) {
	        return true;
        }
	    }
	    return false;
    };

    Game.prototype.removeBullet = function(bullet) {
      this.bullets.splice(this.bullets.indexOf(bullet), 1);
    };

    Game.prototype.checkBullets = function () {
      var bltRadius = Asteroids.Bullet.RADIUS;
      var limit = Game.DIM_X + bltRadius;

      this.bullets.forEach( function(bullet) {
        if (bullet.pos[0] > limit || bullet.pos[1] > limit) {
          game.removeBullet(bullet);
        }
      });
    };
		
		Game.prototype.splitAsteroid = function(asteroid) {
			var subAsteroids = asteroid.generateSubAsteroids();
			var game = this;
			subAsteroids.forEach( function(asteroid) {
				game.asteroids.push(asteroid);
			});
			this.removeAsteroid(asteroid);
		};

    Game.prototype.removeAsteroid = function(asteroid) {
      this.asteroids.splice(this.asteroids.indexOf(asteroid), 1);
			var explosion = new Audio('explosion.wav');
			explosion.play();
    };

    Game.prototype.checkMovingObjects = function () {
      this.asteroids.forEach( function(asteroid) {
		    asteroid.reappear();
      });
			
			this.ship.reappear();
    };

    Game.prototype.fireBullet = function () {
			if (this.ship.canFire) {
				var laser = new Audio('laser.wav');
				laser.play();
	      var newBullet = this.ship.fireBullet(this);
	      this.bullets.push(newBullet);
			}
    };

    Game.prototype.draw = function (ctx) {
			var game = this;
			ctx.fillStyle = "black";
      ctx.fillRect(0, 0, Game.DIM_X, Game.DIM_Y);
			
			this.stars.forEach( function(ctx, star) {
				game.drawStar(ctx, star);
			});

      this.ship.draw(ctx);

      this.asteroids.forEach( function (asteroid) {
        asteroid.draw(ctx);
      });
      this.bullets.forEach( function (bullet) {
        bullet.draw(ctx);
      });
    };

    Game.prototype.move = function () {
      this.ship.move();

      this.asteroids.forEach( function (asteroid) {
        asteroid.move();
      });
      this.bullets.forEach( function (bullet) {
        bullet.move();
      });
    };

    Game.prototype.step = function () {
			var game = this;
			this.keyPressEvents();
      this.move();
      this.checkMovingObjects();
      this.checkBullets();
      this.draw(this.ctx);
      if (this.checkCollisions()) {
        this.stopGame();
      }
			if (this.asteroids.length === 0) {
				game.nextLevel();
			}
    };

    Game.prototype.stopGame = function () {
      clearInterval(this.intervalID);
      var r = confirm("Despite your valiant flying, you have died. Play again?");
			if (r === true) {
				this.currentLevel = 0;
				this.nextLevel();
			}
    };

    Game.prototype.start = function () {
			document.getElementById('music').play();
      this.intervalID = setInterval(this.step.bind(this), 1000 * (1 / Game.FPS));
			this.bindKeyListeners();
    };
		
		Game.prototype.nextLevel = function () {
			clearInterval(this.intervalID);
			var that = this;
			this.currentLevel += 1;
			this.asteroids = [];
	    var pos = [Asteroids.Game.DIM_X / 2, Asteroids.Game.DIM_Y / 2];
	    var vel = [0, 0];
	    this.ship = new Asteroids.Ship(pos, vel);
			this.addAsteroids();
			this.start();
		}
	
		Game.prototype.keyPressEvents = function() {
	    if (this.keyMap[87]) {
			  this.ship.thrust(1);
	    };

	    if (this.keyMap[65]) {
				this.ship.changeDir(-1);
	    };

	    if (this.keyMap[83]) {
				this.ship.thrust(-.5)
	    };

	    if (this.keyMap[68]) {
	      this.ship.changeDir(1);
	    };

	    if (this.keyMap[32]) {
	      this.fireBullet();
	    };
		};
		
		Game.prototype.bindKeyListeners = function () {
			this.keyMap = [];
			var game = this;
			
			var keydown = keyup = function(e) {
				game.keyMap[e.which] = (e.type === 'keydown');
			}
			
			$(document).keydown(keydown);
			$(document).keyup(keyup);
		};

})(this);