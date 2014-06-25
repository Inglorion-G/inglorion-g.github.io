(function (root) {
	
	var Asteroids = root.Asteroids = (root.Asteroids || {});
	
	var Hud = Asteroids.Hud = function (game) {
		this.ctx = game.ctx;
		this.game = game;
		this.instructions = 
		  ["W A S D to move, SPACE to fire, P to pause.", 
		  "Collect powerups and blow up asteroids!",
			"Press any key to play!"];
		this.level = "Starting next level, press any key to begin!";
	}
	
	Hud.prototype.drawScore = function(ctx) {
		ctx.beginPath();
		ctx.font = '30pt monospace';
		ctx.fillStyle = '#FF0000';
		ctx.fillText(game.score, 75, 75)
	}
	
	Hud.prototype.drawLevel = function(ctx) {
		ctx.beginPath();
		ctx.font = '30pt monospace';
		ctx.fillStyle = '#FF0000';
		ctx.fillText("Level " + game.currentLevel, window.innerWidth - 250, 75)
	}
	
	Hud.prototype.drawInstructions = function(ctx) {
		var height = 40;
		ctx.beginPath();
		ctx.font = '20pt monospace';
		ctx.fillStyle = '#FF0000';
		this.instructions.forEach( function(line) {
			ctx.fillText(line, (window.innerWidth / 5), (window.innerHeight / 2) - height);
			height -= 25;
		});
	}
	
	Hud.prototype.nextLevel = function(ctx) {
		var height = 40;
		ctx.beginPath();
		ctx.font = '20pt monospace';
		ctx.fillStyle = '#FF0000';
		ctx.fillText(this.level, (window.innerWidth / 5), (window.innerHeight / 2));
	}
	
	Hud.prototype.pause = function(ctx) {
		var height = 40;
		ctx.beginPath();
		ctx.font = '50pt monospace';
		ctx.fillStyle = '#FF0000';
		ctx.fillText("PAUSED", (window.innerWidth / 3), (window.innerHeight / 2));
	}
	
})(this);