(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Star = Asteroids.Star = function (pos, vel, radius, color) {
	    Asteroids.MovingObject.call(this, pos, vel, radius, color);
    };

    Star.COLOR = "#ffffff";
    Star.RADIUS = 1;

    Star.inherits(Asteroids.MovingObject);

    Star.randomStar = function (maxX, maxY) {
      var posX = maxX * Math.random();
      var posY = maxY * Math.random();
			
      var starPos = [posX, posY];
			var vel = Asteroids.starVel();

      return new Star(
        starPos,
        vel,
        Math.floor((Math.random() * 2) + Star.RADIUS),
        Star.COLOR
      );
    };

})(this);