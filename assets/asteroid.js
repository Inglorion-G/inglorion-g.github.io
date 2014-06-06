(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Asteroid = Asteroids.Asteroid = function (pos, vel, radius, color) {
	    Asteroids.MovingObject.call(this, pos, vel, radius, color);
    };

    Asteroid.COLOR = "black";
    Asteroid.RADIUS = 30;

    Asteroid.inherits(Asteroids.MovingObject);


    Asteroid.randomAsteroid = function (maxX, maxY) {
      var posX = maxX * Math.random();
      var posY = maxY * Math.random();
      while (posX > 220 && posX < 280 && posY > 220 && posY < 280) {
        posX = maxX * Math.random();
        posY = maxY * Math.random();
      }
      var astPos = [posX, posY];

      return new Asteroid(
        astPos,
        Asteroids.randomVec(),
        (Math.random() * Asteroid.RADIUS) + 10,
        Asteroid.COLOR
      );
    };

})(this);