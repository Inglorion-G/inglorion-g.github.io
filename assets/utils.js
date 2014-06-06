(function (root) {

    var Asteroids = root.Asteroids = (root.Asteroids || {});

    Function.prototype.inherits = function (ParentClass) {
      var Surrogate = function () {};

      Surrogate.prototype = ParentClass.prototype;
      this.prototype = new Surrogate();
    };

    Asteroids.randomVec = function() {
      var speed = 100 * Math.random() + 20;
      var direction = 2 * Math.PI * Math.random() - Math.PI;
      return [speed, direction];
    }

})(this);