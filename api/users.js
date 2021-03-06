var express = require('express');
var mysql = require('../dbcon.js');
var auth = require('../routes/adminAuth');
var pool = mysql.pool;
const bcrypt = require('bcrypt');
var router = express.Router();

router.get('/email/available/:email',
	function (req, res, next) {
		pool.query("SELECT false available FROM User where email = ? LIMIT 1",
			[req.params.email],
			function (err, rows, fields) {
				if (err) {
					console.log(err);
				} else {
					let available = true;
					if (rows.length > 0)
						available = false;
					res.json({ "available": available });
				}
			});
	});

router.all('/*', auth.adminUser);

router.delete('/:u_id',
	function (req, res, next) {
		pool.query("CALL deleteUserByID(?)",
			[req.params.u_id],
			function(err, result) {
				if (err) {
					console.log('SERVER ERROR: ' + err);
					return;
				}
				res.statusCode = 200;
				res.send();
			});
	});

router.get('/:u_id',
	function(req, res, next) {
		pool.query("CALL selectUserByID(?)",
			[req.params.u_id],
			function(err, rows, fields) {
				if (err) {
					console.log(err);
				} else {
					res.send(rows);
				}
			});
	});

router.get('/',
	function(req, res, next) {
		if (req.query.email) {
			pool.query("CALL selectUserByEmail(?)",
				[req.query.email],
				function(err, rows, fields) {
					if (err) {
						console.log(err);
						next(err, null);
					} else {
						res.send(rows);
					}
				});
		} else if (req.query.usertype == 'admin') {
			pool.query("CALL selectUserByUserType(?)",
				['admin'],
				function(err, rows, fields) {
					if (err) {
						console.log(err);
					} else {
						res.send(rows[0]);
					}
				});
		} else if (req.query.usertype === 'normal' || req.query.usertype === 'basic') {
			pool.query("CALL selectUserByUserType(?)",
				['normal'],
				function(err, rows, fields) {
					if (err) {
						console.log(err);
					} else {
						res.send(rows[0]);
					}
				});
		} else if (Object.keys(req.query).length === 0) {
			res.status(501).send();
		} else {
			res.status(400).send();
		}
	});

router.put('/admin/password/:u_id',
	async function(req, res, next) {
		if (req.session.u_type !== 'admin' || parseInt(req.session.u_id) !== parseInt(req.params.u_id)) {
			return res.status(401).send();
		}

		if (!isPasswordComplex(req.body.password)) {
			return res.status(400).send("The password was not complex enough");
		};

		var passwordHash;
		try {
			passwordHash = await saltPassword(req.body.password);
		} catch (err) {
			return res.status(400).send("Unable to updatepassword.  Please try again.");
		};

		pool.query("CALL changePwdByID(?,?)",
			[req.params.u_id, passwordHash],
			function(err, rows, fields) {
				if (err) {
					console.log(err);
				} else {
					return res.status(200).send();
				}
			});
	});

router.put('/admin/:u_id',
	function (req, res, next) {
		if (!emailFormatIsValid(req.body.email)) {
			return res.status(400).send("invalid email format");
		}

		pool.query("CALL changeEmailByID(?,?)",
			[req.params.u_id, req.body.email],
			function(err, rows, fields) {
				if (err) {
					console.log(err);
				} else {
					return res.status(200).send(); 
				}
			});
	});

router.put('/normal/:u_id',
	function (req, res, next) {
		if (!emailFormatIsValid(req.body.email)) {
			return res.status(400).send("invalid email format");
		}
		pool.query("UPDATE User SET `fname` = ?, `lname` =  ?, `email` = ? WHERE  `u_id` = ?",
			[req.body.fname, req.body.lname, req.body.email, req.params.u_id],
			function (err, result) {
				if (err) {
					console.log('SERVER ERROR: ' + err);
					next(err);
				} else {
					return res.status(200).send();
				}
			});
	}
);

router.post('/admin',
	async function (req, res, next) {
		if (!emailFormatIsValid(req.body.email)) {
			return res.status(400).send("invalid email format");
		}
		if (!isPasswordComplex(req.body.password)) {
			return res.status(400).send("The password was not complex enough");
		};
		var passwordHash;
		try {
			passwordHash = await saltPassword(req.body.password);
		} catch (err) {
			return res.status(400).send("Unable to create a user.  Please try again.");
		}

		pool.query("CALL addAdminUser(?,?)",
			[req.body.email, passwordHash],
			function(err, rows, fields) {
				if (err) {
					console.log(err);
					return res.status(400).send("Unable to create a user.  Please try again.");
				} else {
					return res.send(rows);
				}
			});
	});

router.post('/normal',
	async function (req, res, next) {
		if (!emailFormatIsValid(req.body.email)) {
			return res.status(400).send("invalid email format");
		}
		if (!isPasswordComplex(req.body.password)) {
			return res.status(400).send("The password was not complex enough");
		};

		var passwordHash;
		try {
			passwordHash = await saltPassword(req.body.password);
		} catch (err) {
			console.log(err);
			return res.status(400).send("Unable to create a user.  Please try again.");;
		}
		pool.query("CALL addNormalUser(?,?,?,?,?)",
			[req.body.email, passwordHash, req.body.fname, req.body.lname, null],
			function(err, rows, fields) {
				if (err) {
					console.log(err);
					return res.status(400).send("Unable to create a user.  Please try again.");
				} else {
					return res.send(rows);
				}
			});

	});

async function saltPassword(password) {
	try {
		const saltRounds = 10;
		const salt = await bcrypt.genSalt(saltRounds);
		const hash = await bcrypt.hash(password, salt);
		return hash;
	} catch (e) {
		console.log("bcrypt errors: " + e);
	}
}

function isPasswordComplex(password) {
	var isComplex = true;
	if (password.length < 8
		|| !password.match(/[0-9]/i)
		|| (password.toUpperCase() === password) 
		|| (password.toLowerCase() === password) 
	)
	{
		isComplex = false;
	}
	return isComplex;
}

function emailFormatIsValid(email) {
	var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return re.test(String(email).toLowerCase());
}

module.exports = { router: router, isPasswordComplex: isPasswordComplex, emailFormatIsValid: emailFormatIsValid}
