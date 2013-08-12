function log(msg,target) {
  var el = document.createElement("p");
  el.innerText = /*"[" + new Date() + "] " + */msg;
  (target || document.getElementById("outPut")).appendChild(el);
}
function cbt(ret) {
	try {
		ret = JSON.stringify(ret);
	} catch (e) {}
	log(ret);
}
function cbtS(ret) {
	log("[success callback] " + typeof(ret));
	cbt(ret);
}
function cbtF(ret) {
	log("[fail callback] " + typeof(ret));
	cbt(ret);
}
function cbtP(ret) {
	log("[progress callback] " + typeof(ret));
	cbt(ret);
}
function myLog(ret) {
log("cloudapi");
cbt(ret);
}