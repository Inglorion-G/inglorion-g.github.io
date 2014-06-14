(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Ship = Asteroids.Ship = function (pos, vel) {
      Asteroids.MovingObject.call(this, pos, vel, Ship.RADIUS, Ship.COLOR);
      this.bearing = 0;
			this.canFire = true;
    };
		
    Ship.RADIUS = 6;
    Ship.COLOR = "green";

    Ship.inherits(Asteroids.MovingObject);

    Ship.prototype.draw = function (ctx) {
			var v = [[-5,-5],[-5,5],[10, 0]];
        // ctx.fillStyle = 'gray';
   //      ctx.beginPath();
   //      ctx.moveTo(this.pos[0], this.pos[1]);
   //      ctx.lineTo(this.pos[0] + 20, this.pos[1]);
   //      ctx.lineTo(this.pos[0] + 10, this.pos[1] + 25);
   //      ctx.closePath();
   //      ctx.fill();
   //      ctx.strokeStyle = 'rgb(0,128,0)';
   //      ctx.lineWidth = 1;
        // ctx.stroke();
               //    top     left    right
        // ctx.save();
        // ctx.fillRect(0, 0, can.width, can.height);
        // ctx.restore();
        ctx.save();
        ctx.translate(this.pos[0],this.pos[1]);
        ctx.rotate(this.bearing);
        ctx.fillStyle = "#7cfc00";
        ctx.strokeStyle = "blue";
        ctx.beginPath();
        ctx.moveTo(v[0][0],v[0][1]);
        ctx.lineTo(v[1][0],v[1][1]);
        ctx.lineTo(v[2][0],v[2][1]);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.restore();
    }
		
		Ship.prototype.turn = function (deg) {
			this.bearing += .01;
		};
		
		Ship.prototype.thrust = function(impulse) {
			var newVel = this.vel.slice(0);
		  newVel[0] += (impulse * Math.cos(this.bearing)) / 10;
		  newVel[1] += (impulse * Math.sin(this.bearing)) / 10;
			
			if (!this.exceedSpeedLimit(newVel)) {
				this.vel = newVel;
			}
		};
		
		Ship.prototype.exceedSpeedLimit = function (newVel) {
	    return (Math.pow(newVel[0], 2) + Math.pow(newVel[1], 2) >= 109)
	  };
		
		Ship.prototype.changeDir = function (mod) {
	    this.bearing += (0.1 * mod);
	  };

    Ship.prototype.fireBullet = function (game) {
			this.canFire = false;
			var ship = this;
			
			setTimeout( function() { ship.canFire = true }, 200);
			
			return new Asteroids.Bullet(this, game);
    };
		
		//line 581 of codepen http://codepen.io/janklever/pen/DGacH?editors=001

})(this);