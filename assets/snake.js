(function (root) {

	var SnakeGame = root.SnakeGame = (root.SnakeGame || {});

	var canvas = document.getElementById('snake_canvas');
	var ctx = canvas.getContext('2d');
	ctx.canvas.height = 480;
	ctx.canvas.width = 480;

	var Apple = SnakeGame.Apple = function(pos) {
		this.pos = pos;
	};

	Apple.prototype.draw = function() {
		var p = this.pos;
		drawEmptySquare(p, 30);
		//drawSquare(p, 30, "C40000");
	};

	var Snake = SnakeGame.Snake = function() {
		this.head_pos = [4, 4];
		this.body_positions = [[4, 3], [4, 2], [4, 1], [4, 0]];
		this.direction = "right";
		this.opposite = "left";
		this.body_length = 4;
	};

	Snake.prototype.move = function() {
		for (var i = this.body_length - 1; i > 0; i--) {
			this.body_positions[i] = this.body_positions[i - 1].slice(0);
		}

		this.body_positions[0] = this.head_pos.slice(0);

		var x = this.head_pos[1];
		var y = this.head_pos[0];

		switch(this.direction) {
			case "up":
				y --;
				if(y < 0)
					y = 15;
				break;

			case "right":
				x = (x + 1) % 16;
				break;

			case "down":
				y = (y + 1) % 16;
				break;

			case "left":
				x --;
				if(x < 0)
					x = 15;
				break;

			default:
				break;
		}

		this.head_pos[1] = x;
		this.head_pos[0] = y;
		this.draw();
	};

	Snake.prototype.draw = function() {
		// draw head segment
		drawSquare(this.head_pos, 30, "251810");

		// draw body segments
		if(this.body_length > 1) {
			$.each(this.body_positions, function(idx, pos) {
				drawSquare(pos, 30, "251810");
			});
		}
	};

	var Game = SnakeGame.Game = function() {
		this.paused = true;
		this.stopped = false;
		this.grow = null;
		this.lost = false;
		this.tiles = {};

		for(var i = 0; i < 16; i++) {
			for(var j = 0; j < 16; j++) {
				this.tiles[[i, j]] = false;
			}
		}
	};

	Game.prototype.tick = function() {
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		this.apple.draw();
		this.growSnake();
		this.snake.move();
		this.checkCollisions();
	};

	Game.prototype.setDir = function(keyCode) {

		var dir = '';

		switch(keyCode) {
			case 38:
			case "up":
				dir = "up";
				opp = "down";
				break;

			case 37:
			case "left":
				dir = "left";
				opp = "right";
				break;

			case 39:
			case "right":
				dir = "right";
				opp = "left";
				break;

			case 40:
			case "down":
				dir = "down";
				opp = "up";
				break;

			default: return;
		}

		if (dir === this.snake.opposite) {
			return;
		} else {
			this.snake.direction = dir;
			this.snake.opposite = opp;
		}
	};

	Game.prototype.run = function() {
		var that = this;
		this.randomApple();
		this.apple.draw();

		$(document).keydown(function(e) {
			var keyCode = e.which;

			if(keyCode > 36 && keyCode < 41) {
				that.setDir(keyCode);
			} else if (keyCode === 32) {
				if (that.paused && !that.lost) {
					that.intervalID = setInterval(that.tick.bind(that), 120);
					that.paused = false;
					$(".info").hide();
				} else {
					clearInterval(that.intervalID);
					that.paused = true;
					$(".info").show();
				}
			}

			e.preventDefault();
		});

		$('.control-btn').on('mousedown touchstart', function() {
			var dir = $(this).attr('id');
			that.setDir(dir);
		});

		$('#snake_canvas').click(function() {
			if (that.paused && !that.lost) {
				that.intervalID = setInterval(that.tick.bind(that), 120);
				that.paused = false;
				$(".info").hide();
			}
		});

		//this.intervalID = setInterval(this.tick.bind(this), 120);
	};

	Game.prototype.addSnake = function() {

		var snake = new Snake();
		this.snake = snake;
	};

	Game.prototype.randomCoord = function() {

		var freeTiles = [];
		for(var tile in this.tiles) {
			if (!this.tiles[tile]) {
				freeTiles.push(tile);
			}
		}

		var n = Math.floor(Math.random() * ((freeTiles.length - 1) - 0 + 1));
		var new_tile = freeTiles[n].split(/,/);
		new_tile.forEach(function(val, i) { new_tile[i] = parseInt(val, 10); });

		return new_tile;
	};

	Game.prototype.randomApple = function() {
		var new_pos = this.randomCoord();
		this.apple = new Apple(new_pos);
	};

	Array.prototype.equals = function(array) {
		for (var i = 0, l = array.length; i < l; i ++) {
			if(this[i] !== array[i]) {
				return false;
			}
		}

		return true;
	};

	Game.prototype.checkCollisions = function() {
		var head = this.snake.head_pos;

		for(var tile in this.tiles) {
			this.tiles[tile] = false;
		}

		for(var i = 0, l = this.snake.body_positions.length; i < l; i ++) {
			var body = this.snake.body_positions[i];
			this.tiles[body] = true;
			if(head.equals(body)) {
				this.stopGame();
			}
		}

		if(this.snake.head_pos.equals(this.apple.pos)) {
			this.randomApple();
			this.apple.draw();
			this.grow = (this.snake.body_positions[this.snake.body_positions.length - 1]).slice(0);
		}
	};

	Game.prototype.growSnake = function() {
		if (this.grow) {
			this.snake.body_positions.push(this.grow);
			this.snake.body_length ++;
			this.grow = null;
		}
	};

	Game.prototype.stopGame = function() {
		clearInterval(this.intervalID);
		this.stopped = true;
		this.lost = true;
		alert("You lost! Reload to try again!");
	};

	function drawEmptySquare(pos, mag) {
		var m = Math.floor(mag / 10);
		var y = pos[0] * mag + m;
		var x = pos[1] * mag + m;
		ctx.beginPath();
		ctx.lineWidth = m;
		ctx.strokeStyle = "#251810";
		ctx.strokeRect(x, y, mag - (2 * m), mag - (2 * m));
	}

	function drawSquare(pos, mag, color) {
		var y = pos[0] * mag;
		var x = pos[1] * mag;
		ctx.beginPath();
		ctx.rect(x, y, mag, mag);
		ctx.fillStyle = "#" + color;
		ctx.fill();
		ctx.lineWidth = Math.floor(mag / 10);
		ctx.strokeStyle = "#9ACC99";
		ctx.stroke();
	}

})(this);