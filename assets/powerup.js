(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var PowerUp = Asteroids.PowerUp = function (pos, vel) {
	    Asteroids.MovingObject.call(this, pos, vel, PowerUp.RADIUS, PowerUp.COLOR);
    };

    PowerUp.COLOR = "magenta";
    PowerUp.RADIUS = 5;

    PowerUp.inherits(Asteroids.MovingObject);
		
    PowerUp.prototype.draw = function (ctx) {
	    ctx.fillStyle = this.color;
      ctx.fillRect(this.pos[0], this.pos[1], 10, 10);
			ctx.strokeStyle = this.COLOR;
			ctx.stroke();
			ctx.lineWidth = 2;
			
	    ctx.fill();
    };

})(this);