var express = require('express');
var router = express.Router();
var mysql = require('../dbcon.js');
var pool = mysql.pool;
const bcrypt = require('bcrypt');
var adminEmail = 'admin@oregonstate.edu';


function updateUser(req, res, next) {
	pool.query("UPDATE User SET `fname` = ?, `lname` =  ?, `email` = ? WHERE  `u_id` = ? AND `email` <> ?",
		[req.body.fname, req.body.lname, req.body.email, req.body.uid, adminEmail],
		function (err, result) {
			if (err) {
				console.log('SERVER ERROR: ' + err);
				next(err);
			} else {
				next();
			}
		});
}

router.put('/update', validateSession, updateUser, redirectToAdmin);

function validateSession(req, res, next) {
	//if (req.SESSION_SECRET === process.env.SESSION_SECRET) {
	//	console.log("session verified");
	//	next();
	//}
	//console.log("session is unverifiable");
	//res.redirect('/');
	return next();
}

function deleteUser(req, res, next) {
	pool.query("DELETE FROM User WHERE u_id = ? AND email <> ?",
		[req.params.id, adminEmail],
		function (err, result) {
			if (err) {
				console.log('SERVER ERROR: ' + err);
				next(err);
				return;
			} else {
				next();
			}
		});
}

function redirectToAdmin(req, res, next) {
	res.redirect('/admin');
}

router.delete('/delete/:id', validateSession, deleteUser, redirectToAdmin);



function checkUserType(req, res, next) {
	console.log(req.body);
	if (req.body.usertype) {
		req.body.usertype = req.body.usertype.toLowerCase();
		if (req.body.usertype === 'basic') {
			req.body.usertype = 'normal';
		}
		if (req.body.usertype === 'admin' || req.body.usertype === 'normal') {
			return next();
		}
	} else {
		console.log("The user type was not sent");
		redirectToAdmin(req, res, next);
	}
}

function validateCreateRequest(req, res, next) {
	if (req.body.password.length < 8) {
		res.invalidreq.passwordTooShort = true;
	}
	if (!req.body.password.match(/[0-9]/i)) {
		res.invalidreq.passwordNoNumber = true;
	}
	if (!req.body.password.match(/[A-Z]/i)) {
		res.invalidreq.passwordNoUpperCase = true;
	}
	if (!req.body.password.match(/[a-z]/i)) {
		res.invalidreq.passwordNoLowerCase = true;
	}
	if (res.invalidreq) {
		res.statusCode(400);
	}
	console.log("validate request here");
	next();
}

function saltPassword(req, res, next) {
	const saltRounds = 10;
	bcrypt.genSalt(saltRounds,
		function(err, salt) {
			if (err) {
				console.log('SERVER ERROR: ' + err);
				next(err);
			}
			bcrypt.hash(req.body.password,
				salt,
				function(err, hash) {
					if (err) {
						console.log('SERVER ERROR: ' + err);
						next(err);
					} else {
						req.body.pwd_hash = hash;
						next();
					}
				});

		});
}

function createUser(req, res, next) {
	pool.query("INSERT INTO User (`u_type`, `fname`, `lname`, `email`, `pwd_hashed`) VALUES (?,?,?,?,?)",
			[ req.body.usertype, req.body.fname, req.body.lname, req.body.email, req.body.pwd_hash],
		function (err, result) {
			if (err) {
				console.log('SERVER ERROR: ' + err);
				next(err);
				return;
			} else {
				next();
			}
		});
};

router.post('/create/user', validateSession, checkUserType, validateCreateRequest, saltPassword ,createUser, redirectToAdmin);

/* GET users listing. */
router.get('/', getNormalUsers, getAdminUsers, renderAdminPage);

function getNormalUsers(req, res, next) {
	pool.query("SELECT u_id, email, fname, lname, DATE_FORMAT(creation_datetime, \"%M %d %Y\") as creation_datetime, signature from User where u_type like 'normal'",
		function (err, rows, fields) {
			if (err) {
				console.log(err);
				next(err, null);
			} else {
				req.userData = rows;
				next();
			}
		});
};

//function addSignatureImagePath(req, res, next) {

//	for (var i = 0, len = req.normalUsers.length; i < len; i++) {
//		//someFn(arr[i]);
//		var imgPath = 'public/signatures/';
//		var imgName = req.normalUsers[i].email + '_signature';
//		var imgFullPath = '/' + imgPath + imgName + '.png';
//		base64Img.imgSync(req.body.base64, imgPath, imgName);

//	}

//	//req.normalUsers.forEach( function(item)
//	//{
//	//	var imgPath = 'public/signatures/';
//	//	var imgName = req.body.email + '_signature';
//	//	var imgFullPath = '/' + imgPath + imgName + '.png';
//	//	base64Img.imgSync(req.body.base64, imgPath, imgName);
//	//});		
//};

function getAdminUsers(req, res, next) {
	pool.query("SELECT u_id, email, fname, lname, DATE_FORMAT(creation_datetime, \"%M %d %Y\") as creation_datetime from User where u_type like 'admin'",
		function (err, rows, fields) {
			if (err) {
				console.log(err);
				next(err, null);
			} else {
				req.adminUsers = rows;
				next();
			}
		});
};

function renderAdminPage (req, res) {
	//res.send('respond with a resource');
	if (req.session.u_type === 'admin') {

		var context = {};

		
		context.customScript = '<script src="public/scripts/emailAvailability.js"></script>';
		context.customScript += '<script src="public/scripts/passwordComplexity.js"></script>';
		context.customScript += '<script src="public/scripts/adminFunctions.js"></script>';
		context.customScript += '<script src="public/scripts/prefillUpdateModal.js"></script>';
		context.customScript += '<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>';
		context.customScript += '<script src="public/scripts/businessIntelligence.js"></script>';
		
		
		context.title = 'Admin Account';
		//context.email = req.session.email;
		context.session = { email: req.session.email };
		context.adminData = req.adminUsers;
		context.userData = req.userData;
		//context.userData = req.normalUsers;
		//context.adminData = req.adminUsers;
		context.countUsers = req.userData.length;
		context.countAdmin = req.adminUsers.length;
		
		res.render('admin', context);

	} else { // Going back to login page if user is not logged in
		res.redirect('/');
	}
}

module.exports = router;
