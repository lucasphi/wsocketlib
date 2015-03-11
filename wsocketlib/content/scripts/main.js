$(document).ready(function() {
	
	//ws.addStrategy({
	//	opcode: 0x01,
	//	onMessage: function(data) {
	//		if (data.success) {
	//			$("#loginbox").hide();
	//			$("#pcinfobox").show();
	//		}
	//		else {
	//			alert('Usuario ou senha inválido');
	//		}
	//	}
	//});
	
	//ws.addStrategy({
	//	opcode: 0x10,
	//	onMessage: function(data) {
	//		$('#processcount').html(data.value);
	//	}
	//});
    //
	//ws.addStrategy({
	//	opcode: 0x11,
	//	onMessage: function(data) {
	//		var process = "";
	//		$.each(data.value, function(index, val) {
	//			process += val.name + " <span style=\"float:right\">Memoria: " + val.memory +  "k</span><br />";
	//		});
	//		$('#processlist').html(process);
	//	}
	//});

	ws.addStrategy({
		opcode: 0x20,
		onMessage: function(message) {
			alert(message.data);
		}
	});
 	
 	$("#loginbtn").click(function() {
 		ws.send({
 			opcode: 0x01,
			data: {
				username: $("#username").val(),
				pwd: $("#pwd").val()
			}
 		});
 	});
 	
});

var ws = new wsocketlib.Socket({
	attemptReconnect: 'true',
	onOpen: function() {
		$('#connectbtn').hide();
		$("#loginbtn").removeAttr("disabled");
	}
});

ws.setAdapter('read', function(message) {
	return { opcode: 0x20, data: message };
});

ws.setAdapter('write', function(pkg) {
	return pkg.data.username;
});