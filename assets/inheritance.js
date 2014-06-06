// function Animal(name) {
//     this.name = name;
// }
// 
// Animal.prototype.sayName = function () {
//     console.log("My name is: " + this.name);
// }
// 
// function Frog() {
// 
// }
// 
// Frog.prototype = new Animal;
// 
// f = new Frog('fred');
// 
// f.sayName;
// 
// Function.prototype.inherits = function (ParentClass) {
//     var Surrogate = function () {};
// 
//     Surrogate.prototype = ParentClass.prototype;
//     this.prototype = new Surrogate();
// };
// 
// function MovingObject (direction) {
//     this.direction = direction;
// };
// 
// MovingObject.prototype.getDirection = function () {
//     return this.direction;
// };
// 
// function Ship (direction) {
//     MovingObject.call(this, direction);
// };
// 
// Ship.inherits(MovingObject);
// 
// s = new Ship("left");
// console.log(s.getDirection())
// 
// function Asteroid (direction) {
//     MovingObject.call(this, direction);
// };
// 
// Asteroid.inherits(MovingObject);
// a = new Asteroid("right");
// console.log(a.getDirection())