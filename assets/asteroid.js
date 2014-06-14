(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Asteroid = Asteroids.Asteroid = function (pos, vel, radius, color) {
	    Asteroids.MovingObject.call(this, pos, vel, radius, color);
    };

    Asteroid.COLOR = "#7cfc00";
    Asteroid.RADIUS = 30;

    Asteroid.inherits(Asteroids.MovingObject);
		
		Asteroid.prototype.generateSubAsteroids = function() {
			
			var vel1 = Asteroids.randomVel();
			var vel2 = Asteroids.randomVel();
			
			var subAsteroid1 = new Asteroids.Asteroid(this.pos, vel1, this.radius / 2, Asteroid.COLOR);
			var subAsteroid2 = new Asteroids.Asteroid(this.pos, vel2, this.radius / 2, Asteroid.COLOR);
			return [subAsteroid1, subAsteroid2];
		};

    Asteroid.randomAsteroid = function (maxX, maxY) {
      var posX = maxX * Math.random();
      var posY = maxY * Math.random();
			var midX = maxX / 2
			var midY = maxY / 2
			
      while (posX > midX - 30 && posX < midX + 30 && posY > midY - 30 && posY < midY + 30) {
        posX = maxX * Math.random();
        posY = maxY * Math.random();
      }
      var astPos = [posX, posY];

      return new Asteroid(
        astPos,
        Asteroids.randomVel(),
        (Math.random() * Asteroid.RADIUS) + 10,
        Asteroid.COLOR
      );
    };

})(this);