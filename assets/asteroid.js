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
		
    Asteroid.prototype.draw = function (ctx) {
	    ctx.fillStyle = this.color;
	    ctx.beginPath();
	    ctx.arc(
	      this.pos[0],
	      this.pos[1],
	      this.radius,
	      0,
	      2 * Math.PI,
	      false
			);
			ctx.strokeStyle = "green";
			ctx.stroke();
			ctx.lineWidth = 2;
			
	    ctx.fill();
    };

    Asteroid.randomAsteroid = function (maxX, maxY) {
      var posX = maxX * Math.random();
      var posY = maxY * Math.random();
			var midX = maxX / 2
			var midY = maxY / 2
			
      while (posX > midX - 100 && posX < midX + 100 && posY > midY - 100 && posY < midY + 100) {
        posX = maxX * Math.random();
        posY = maxY * Math.random();
      }
			
      var astPos = [posX, posY];

      return new Asteroid(
        astPos,
        Asteroids.randomVel(),
        (Math.random() * Asteroid.RADIUS) + 30,
        Asteroid.COLOR
      );
    };

})(this);