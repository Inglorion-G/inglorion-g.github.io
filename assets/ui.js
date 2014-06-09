(function (root) {
  var TTT = root.TTT = (root.TTT || {});


  var GameUi = TTT.GameUi = function($rootEl) {
    this.$el = $rootEl;
    this.game = new TTT.Game();
    this.setUpBoard();
    $("#board").on("click", ".unclicked-square", this.markBoard.bind(this));
  }

  GameUi.prototype.markBoard = function(event) {
    var $square = $(event.target);
    //alert("works!")
    // var mark = this.game.player;
    var pos = $square.attr("id");

    var that = this

    if (this.game.move(eval(pos))) {
      alert("You won!")
      that.setUpBoard();
      that.game = new TTT.Game();
      that.game.player = that.games.marks[0];
    };

    $square.removeClass('unclicked-square')
    $square.addClass('clicked-square')
    $square.append("<div class="+ that.game.player +">"+that.game.player+"</div>");
  }

  GameUi.prototype.setUpBoard = function() {
    var boardString = "";
    for(var r = 0; r<3; r++){
      for(var c = 0; c<3; c++){
        boardString += "<div class='square unclicked-square' id='[" + r + ","+ c +"]'></div>";
      }
    };
    this.$el.html(boardString);
  };

  GameUi.prototype.setUpEvents = function () {
    this.game.run();
    this.$el.click('.square', this.markBoard.bind(this));
  };

})(this);