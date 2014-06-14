(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var MovingObject = Asteroids.MovingObject =
      function (pos, vel, radius, color) {
      this.pos = pos;
      this.vel = vel;
      this.radius = radius;
      this.color = color;
    };

    MovingObject.prototype.move = function () {
      var dx = this.vel[0];
			var dy = this.vel[1];
			this.pos = [(this.pos[0] + dx), (this.pos[1] + dy)]
    };

    MovingObject.prototype.draw = function (ctx) {
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
			
	    ctx.fill();
    };
		
		MovingObject.prototype.reappear = function () {
			var radius = this.radius;
			var x = this.pos[0];
			var y = this.pos[1];
			var xlimit = window.innerWidth + radius;
			var ylimit = window.innerHeight + radius;
			
			if (x > xlimit) {
				var newx = x - xlimit;
				return this.pos = [newx, y];
			} else if (x < 0 - radius) {
				var newx = x + xlimit;
				return this.pos = [newx, y];
			} else if (y > ylimit) {
				var newy = y - ylimit;
				return this.pos = [x, newy];
			} else if (y < 0 - radius) {
				var newy = y + ylimit;
				return this.pos = [x, newy];
			}
			
			return this.pos = [x, y];
		};

    MovingObject.prototype.isCollidedWith = function (otherObject) {
			var x1 = this.pos[0];
			var x2 = otherObject.pos[0];
			var y1 = this.pos[1];
			var y2 = otherObject.pos[1];
			
      var distance = Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));

      return (this.radius + otherObject.radius) > distance;
    };

})(this);