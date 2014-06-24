(function (root) {
	
	var Asteroids = root.Asteroids = (root.Asteroids || {});
	
	var Hud = Asteroids.Hud = function (game) {
		this.ctx = game.ctx;
		this.game = game;
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
	
})(this);