(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    var Ship = Asteroids.Ship = function (pos, vel) {
      Asteroids.MovingObject.call(this, pos, vel, Ship.RADIUS, Ship.COLOR);
      this.bearing = 0;
			this.canFire = true;
			this.weapon = 0;
    };
		
    Ship.RADIUS = 10;
    Ship.COLOR = "#0DFFF7";

    Ship.inherits(Asteroids.MovingObject);

    Ship.prototype.draw = function (ctx) {
			var v = [[-10,-10],[-10,10],[20, 0]];
        ctx.save();
        ctx.translate(this.pos[0],this.pos[1]);
        ctx.rotate(this.bearing);
        ctx.fillStyle = "#0DFFF7";
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
			
			return new Asteroids.Bullet(this, game, "#FF0000");
    };
		
		Ship.prototype.fireShotgun = function (game) {
			this.canFire = false;
			var ship = this;
			var blast = [];
			
			setTimeout( function() { ship.canFire = true }, 300);
			
			var left = new Asteroids.Bullet(this, game, "#E89E0C");
			left.vel[0] -= Math.cos(left.vel[0] - 1);
			left.vel[1] -= Math.sin(left.vel[0] - 1);
			var middle = new Asteroids.Bullet(this, game, "#E89E0C");
			var right = new Asteroids.Bullet(this, game, "#E89E0C");
			right.vel[0] += Math.cos(left.vel[0] + 1);
			right.vel[1] += Math.sin(left.vel[0] + 1);
			blast.push(left);
			blast.push(middle);
			blast.push(right);
			
			return blast;
		};
		
		//line 581 of codepen http://codepen.io/janklever/pen/DGacH?editors=001

})(this);