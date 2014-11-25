(function (root) {

	var SnakeGame = root.SnakeGame = (root.SnakeGame || {});

	var Apple = SnakeGame.Apple = function(pos) {
		this.pos = pos;
	};

	Apple.prototype.draw = function(p) {
		var pos = "#"+p[0]+"_"+p[1];
		$(pos).addClass("apple");
	};

	Apple.prototype.remove = function() {
		$(".tile").removeClass("apple");
	}

	var Snake = SnakeGame.Snake = function() {
		this.head_pos = [4, 4];
		this.body_positions = [[4, 3], [4, 2], [4, 1], [4, 0]];
		this.direction = "right";
		this.opposite = "left";
		this.body_length = 4;
	}

	Snake.prototype.move = function() {
		for (var i = this.body_length - 1; i > 0; i--) {
			this.body_positions[i] = this.body_positions[i - 1].slice(0);
		}
		this.body_positions[0] = this.head_pos.slice(0);

		if (this.direction === "up") {
			this.head_pos[0] --;
		} else if (this.direction === "right") {
			this.head_pos[1] ++;
		} else if (this.direction === "down") {
			this.head_pos[0] ++;
		} else if (this.direction === "left") {
			this.head_pos[1] --;
		}

		if (this.head_pos[1] === 16) {
			this.head_pos[1] = 0;
		} else if (this.head_pos[1] === -1) {
			this.head_pos[1] = 15;
		} else if (this.head_pos[0] === 16) {
			this.head_pos[0] = 0;
		} else if (this.head_pos[0] === -1) {
			this.head_pos[0] = 15;
		}

		this.draw();
	};

	Snake.prototype.draw = function() {
		$(".tile").removeClass("snake");

		$("#"+this.head_pos.join("_")).addClass("snake");

		if(this.body_length > 1) {
			$.each(this.body_positions, function(idx, pos) {
				$("#" + pos.join("_")).addClass("snake");
			});
		}
	};

	var Game = SnakeGame.Game = function() {
		this.paused = true;
		this.stopped = false;
		this.grow = null;
	};

	Game.prototype.setBoard = function() {
		var row = 0;
		var col = 0;
		var snk = "snake";
		for(i = 0; i < 256; i++) {
			$(".container").append("<div id=" + row + "_" + col + " class='tile'></div>");
			if (col === 15) {
				row ++;
				col = 0;
			} else {
				snk = "";
				col ++;
			}
		}
	};

	Game.prototype.tick = function() {
		this.growSnake();
		this.snake.move();
		this.checkCollisions();
	};

	Game.prototype.setDir = function(dir) {

		if (dir === this.snake.opposite) {
			return
		}

		this.snake.direction = dir;
		switch(dir) {
			case "up":
			this.snake.opposite = "down";
			break;

			case "left":
			this.snake.opposite = "right";
			break;

			case "right":
			this.snake.opposite = "left";
			break;

			case "down":
			this.snake.opposite = "up";
			break;

			default: return;
		}
	};

	Game.prototype.run = function() {
		var that = this;
		this.randomApple();
		this.apple.draw(this.apple.pos);

		$(document).keydown(function(e) {
			switch(e.which) {
				case 37:
				that.setDir("left");
				break;

				case 38:
				that.setDir("up");
				break;

				case 39:
				that.setDir("right");
				break;

				case 40:
				that.setDir("down");
				break;

				case 32:
				if (that.paused) {
					that.intervalID = setInterval(that.tick.bind(that), 120);
					that.paused = false;
					$(".info").hide();
				} else {
					clearInterval(that.intervalID);
					that.paused = true;
					$(".info").show();
				}
				break;

				default: return;
			}
			e.preventDefault();
		});

		//this.intervalID = setInterval(this.tick.bind(this), 120);
	};

	Game.prototype.addSnake = function() {

		var snake = new Snake();
		this.snake = snake;
	};

	Game.prototype.randomApple = function() {
		var x = Math.floor(Math.random() * (15 - 0 + 1));
		var y = Math.floor(Math.random() * (15 - 0 + 1));

		this.apple = new Apple([x, y]);
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

		for(var i = 0, l = this.snake.body_positions.length; i < l; i ++) {
			var body = this.snake.body_positions[i];
			if(head.equals(body)) {
				this.stopGame();
			}
		}

		if(this.snake.head_pos.equals(this.apple.pos)) {
			this.apple.remove();
			this.randomApple();
			this.apple.draw(this.apple.pos);
			this.grow = (this.snake.body_positions[this.snake.body_positions.length - 1]).slice(0);
		}
	};

	Game.prototype.growSnake = function() {
		if (this.grow) {
			this.snake.body_positions.push(this.grow);
			this.snake.body_length ++;
			this.grow = null;
		}
	}

	Game.prototype.stopGame = function() {
		clearInterval(this.intervalID);
		this.stopped = true;
		alert("You lost! Reload to try again!");
	};

})(this);