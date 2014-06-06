(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Bullet = Asteroids.Bullet = function (pos, direction, game) {
      Asteroids.MovingObject.call(
        this, pos, [Bullet.SPEED, direction], Bullet.RADIUS, Bullet.COLOR
      );
      this.game = game;
    };

    Bullet.inherits(Asteroids.MovingObject);

    Bullet.RADIUS = 2;
    Bullet.COLOR = "red";
    Bullet.SPEED = 140;

    Bullet.prototype.hitAsteroids = function() {
      bullet = this;

      this.game.asteroids.forEach( function(asteroid) {
        if (bullet.isCollidedWith(asteroid)) {
          game.removeAsteroid(asteroid);
          game.removeBullet(bullet);
        };
      });
    };

    Bullet.prototype.move = function () {
      Asteroids.MovingObject.prototype.move.call(this);
      this.hitAsteroids();
    };
})(this);