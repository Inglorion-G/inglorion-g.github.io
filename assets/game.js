(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Game = Asteroids.Game = function (ctx) {
	    this.ctx = ctx;
	    this.asteroids = [];
	    this.addAsteroids(15);
	    this.bullets = [];

	    var pos = [Asteroids.Game.DIM_X / 2, Asteroids.Game.DIM_Y / 2];
	    var vel = [0, 0];
	    this.ship = new Asteroids.Ship(pos, vel);
    };

    Game.DIM_X = window.innerWidth;
    Game.DIM_Y = window.innerHeight;
    Game.FPS = 60;

    Game.prototype.addAsteroids = function (astNum) {
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

    Game.prototype.removeAsteroid = function(asteroid) {
      this.asteroids.splice(this.asteroids.indexOf(asteroid), 1);
    };

    Game.prototype.checkMovingObjects = function () {
      this.asteroids.forEach( function(asteroid) {
		    asteroid.reappear();
      });
			
			this.ship.reappear();
    };

    Game.prototype.fireBullet = function () {
      var newBullet = this.ship.fireBullet(this);
      this.bullets.push(newBullet);
    };

    Game.prototype.draw = function (ctx) {
			ctx.fillStyle = "black";
      ctx.fillRect(0, 0, Game.DIM_X, Game.DIM_Y);

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
      this.move();
      this.checkMovingObjects();
      this.checkBullets();
      this.draw(this.ctx);
      if (this.checkCollisions()) {
        this.stop();
      }
    };

    Game.prototype.stop = function () {
      clearInterval(this.intervalID);
      alert("Despite your valiant ship flying. You have died.");
    };

    Game.prototype.start = function () {
      this.intervalID = setInterval(this.step.bind(this), 1000 * (1 / Game.FPS));
    };

})(this);