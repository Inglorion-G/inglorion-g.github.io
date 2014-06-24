(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Bullet = Asteroids.Bullet = function (ship, game, color) {
			
	    Bullet.RADIUS = 2;
	    this.color = color;
	    Bullet.SPEED = 10;
			
			var pos = ship.pos;
			var vel = ship.vel;
			var bearing = ship.bearing;
		  var newVel = vel.slice(0)
		  newVel[0] += (5 * Math.cos(bearing));
		  newVel[1] += (5 * Math.sin(bearing));
			vel = newVel;
			
      Asteroids.MovingObject.call(this, pos, vel, Bullet.RADIUS, this.color);
      this.game = game;
    };

    Bullet.inherits(Asteroids.MovingObject);

    Bullet.prototype.hitAsteroids = function() {
      bullet = this;

      this.game.asteroids.forEach( function(asteroid) {
        if (bullet.isCollidedWith(asteroid)) {
					if (asteroid.radius >= 20) {
						this.game.splitAsteroid(asteroid);
						this.game.score += 5;
					} else {
						game.removeAsteroid(asteroid);
						this.game.score += 10;
						if (this.game.ship.weapon === 0 && this.game.powerUp === false) {
							var powerUp = new Asteroids.PowerUp(asteroid.pos, Asteroids.randomVel());
							this.game.powerUps.push(powerUp)
							this.game.powerUp = true;
						}
					}
          game.removeBullet(bullet);
        };
      });
    };

    Bullet.prototype.move = function () {
      Asteroids.MovingObject.prototype.move.call(this);
      this.hitAsteroids();
    };
		
})(this);