(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    Function.prototype.inherits = function (ParentClass) {
      var Surrogate = function () {};

      Surrogate.prototype = ParentClass.prototype;
      this.prototype = new Surrogate();
    };

    Asteroids.randomVel = function() {
			var x = Math.floor(Math.random() * (5)) - 2;
			var y = Math.floor(Math.random() * (5)) - 2;
			if (x === 0 && y === 0) {
				x += 1;
				y += 1;
			}
			return [x, y];
    };
		
		Asteroids.starVel = function() {
			var x = Math.floor(Math.random() * (-2));
			var y = 0;
			if (x === 0) {
				x -= 1;
			}
			
			return [x, y];
		};
		
		// math functions
		
	  Number.prototype.toRads = function () {
	    return (2 * parseInt(this) * Math.PI)/360;
	  };
		
		Asteroids.toRadians = function(degrees) {
			return ((degrees * Math.PI) / 180)
		};
		
		sin = function (degrees) {
	    var rads = degrees.toRads();
	    return Math.sin(rads);
	  };

	  cos = function (degrees) {
	    var rads = degrees.toRads();
	    return Math.cos(rads);
	  };

		  

})(this);