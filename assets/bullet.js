(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Bullet = Asteroids.Bullet = function (ship, game) {
			
	    Bullet.RADIUS = 2;
	    Bullet.COLOR = "red";
	    Bullet.SPEED = 10;
			var pos = ship.pos;
			var vel = ship.vel;
			var bearing = ship.bearing;
		  var newVel = vel.slice(0)
		  newVel[0] += (5 * Math.cos(bearing));
		  newVel[1] += (5 * Math.sin(bearing));
			vel = newVel;
			
      Asteroids.MovingObject.call(
        this, pos, vel, Bullet.RADIUS, Bullet.COLOR
      );
      this.game = game;
    };

    Bullet.inherits(Asteroids.MovingObject);

    Bullet.prototype.hitAsteroids = function() {
      bullet = this;

      this.game.asteroids.forEach( function(asteroid) {
        if (bullet.isCollidedWith(asteroid)) {
					if (asteroid.radius >= 20) {
						this.game.splitAsteroid(asteroid);
					} else {
						game.removeAsteroid(asteroid);
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