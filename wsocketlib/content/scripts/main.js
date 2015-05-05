$(document).ready(function() {

	ws.addStrategy({
		opcode: 0x20,
		onMessage: function(message) {
			alert(message.data);
		}
	});
 	
 	$("#msgbtn").click(function() {
 		ws.send({
 			opcode: 0x20,
			data: {
				msg: $("#msg").val(),
			}
 		});
 	});
 	
});

var ws = new wsocketlib.Socket();

ws.setAdapter('read', function(message) {
	return { opcode: 0x20, data: message };
});

ws.setAdapter('write', function(pkg) {
	return pkg.data.msg;
});