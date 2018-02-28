var express = require('express');
var router = express.Router();
var mysql = require('../dbcon.js');
var pool = mysql.pool;
//var moment = require('moment');
var moment = require('moment-timezone');
var passwordValidator = require('password-validator');
var bcrypt = require('bcrypt');

const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');

/*
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
*/

var signature_local = null;


// Function: validateNormalUser
var validateNormalUser = function (req, res, next) {
	console.log("Exectuing validateNormalUser");
	
	if (req.session.u_type == 'normal') { // If user has session and session variable shows a normal user
		
			// Check if session variable exists
			if (!req.session.u_id) {
				return res.redirect(401, '/logout');
			}

			// Compare user data with those in db
			console.log("checking User db");
			pool.query("CALL selectUserByID(?)", [req.session.u_id], function(err, result, fields) {
			
				//console.log(typeof result); // Object
				//console.log(result); // result[0] is the array of rows
				//console.log(JSON.stringify( result[0][0]) );
				//console.log(result[0][0]['u_id'] + result[0][0]['lname']);
				//console.log(result[0].length);
	
				if (err) {	// Database connection error
					console.log(err);
					req.session.user_error_message = 'User table connection failed.';
					req.session.user_redirect_message = 'Logging out in 5 seconds.';
					req.session.redirect_location = '/logout';
					req.session.timeout_ms = 5000;

					req.session.save(function(e) {
						res.redirect(303, '/users_error');
					});
					/*
					res.render('users_error', {
						title: 'User Account - Error',
						error_message: 'User table connection failed.',
						redirect_message: 'Logging out in 5 seconds.',
						redirect_location: '/logout',
						timeout_ms: 5000
					});
					*/
					
				}
				else if (result[0].length != 1) {	// No user with u_id = req.session.u_id in db

					req.session.user_error_message = 'User does not exist.';
					req.session.user_redirect_message = 'Logging out in 5 seconds.';
					req.session.redirect_location = '/logout';
					req.session.timeout_ms = 5000;

					req.session.save(function(e) {
						res.redirect(303, '/users_error');
					});
					/*
					res.render('users_error', {
						title: 'User Account - Error',
						error_message: 'User does not exist.',
						redirect_message: 'Logging out in 5 seconds.',
						redirect_location: '/logout',
						timeout_ms: 5000
					});
					*/
				}
				else if (result[0][0]['creation_datetime'] != req.session.creation_datetime) {
					// creation timestamp doesn't match

					req.session.user_error_message = 'User creation timestamp does not match.';
					req.session.user_redirect_message = 'Logging out in 5 seconds.';
					req.session.redirect_location = '/logout';
					req.session.timeout_ms = 5000;

					req.session.save(function(e) {
						res.redirect(303, '/users_error');
					});
					/*
					res.render('users_error', {
						title: 'User Account - Error',
						error_message: 'User creation timestamp does not match.',
						redirect_message: 'Logging out in 5 seconds.',
						redirect_location: '/logout',
						timeout_ms: 5000
					});
					*/
				}
				else {	// User exists. Compare session variables with db data
					if (result[0][0]['email'] != req.session.email) {
						req.session.email = result[0][0]['email'];
					}
					if (result[0][0]['fname'] != req.session.fname) {
						req.session.fname = result[0][0]['fname'];
					}
					if (result[0][0]['lname'] != req.session.lname) {
						req.session.lname = result[0][0]['lname'];
					}
					signature_local = result[0][0]['signature'];
					req.session.save(function(err) {
						next();
					});
				}
				
			});
		
	} else if (req.session.u_type == 'admin') {
		res.redirect('/admin'); // If user has session but is an admin user, direct to /admin
	} else {
		res.redirect('/'); // If there is no session, go back to login page
	}
};


// Router: PATCH '/editName'
router.patch('/editName',

	// check fields
	body('input_fname').trim().isLength({ min: 1 }).withMessage('First name must be specified.'),
	body('input_lname').trim().isLength({ min: 1 }).withMessage('Last name must be specified.'),

	// sanitize fields
	sanitizeBody('input_fname').trim(),
	sanitizeBody('input_lname').trim(),
	
	// validate user
	validateNormalUser,

	// Process request after validation and sanitization
	function(req, res) {
		
		const errorFormatter = ({ location, msg, param, value, nestedErrors }) => {
			return `${location}[${param}]: ${msg}`;
		};
		var validattion_errors = validationResult(req).formatWith(errorFormatter);

        if (!validattion_errors.isEmpty()) {
			// There are errors
			console.log(validattion_errors.array().toString());
			//res.setHeader('Content-Type', 'text/event-stream');
			res.status(400).send(validattion_errors.array().toString());
            return;
        }
        else {
			// Data from form is valid. Update database entry
			pool.query("CALL changeUserNameByID(?,?,?)", [req.session.u_id, req.body.input_fname, req.body.input_lname],
				function(err, result, fields) {
					if (err) {
						//res.setHeader('Content-Type', 'text/event-stream');
						res.status(500).send(err);
            			return;
					}
					else {
						//console.log(result);
						//res.setHeader('Content-Type', 'text/event-stream');
						res.status(200).send('Name changed successfully!');
						// must send some string for 'fetch' to process on the client side
					}
			});

		}
	}
);



// Router: PATCH '/updateSig'
router.patch('/updateSig',

	// validate user
	validateNormalUser,

	// Process request
	function(req, res) {
		
		pool.query("CALL changeSignatureByID(?,?)", [req.session.u_id, req.body.input_sig_blob],
			function(err, result, fields) {
				if (err) {
					//res.setHeader('Content-Type', 'text/event-stream');
					res.status(500).send(err);
           			return;
				}
				else {
					//console.log(result);
					//res.setHeader('Content-Type', 'text/event-stream');
					res.status(200).send('Signature changed successfully!');
					// must send some string for 'fetch' to process on the client side
				}
		});

	}
);


// Router: PATCH '/changePwd'
router.patch('/changePwd',

	// password validation should have been completed on the client side
	
	// validate user
	//validateNormalUser,

	// Process request after validation and sanitization
	function(req, res) {
		
		var pwdValidator = new passwordValidator();
		pwdValidator
			.is().min(8)			// Minimum length 8 
			.is().max(50)			// Maximum length 50 
			.has().uppercase()		// Must have uppercase letters 
			.has().lowercase()		// Must have lowercase letters 
			.has().digits()			// Must have digits 
			.has().not().spaces();	// Should not have space

        if (req.body.input_pwd !== req.body.input_pwd_verify) {
			console.log("Error: Received passwords do not match.");
			//res.setHeader('Content-Type', 'text/event-stream');
			res.status(400).send("Passwords do not match.");
            return;
		}
		else if (pwdValidator.validate(req.body.input_pwd) == false) {
			// Password didn't pass validation
			var failedPwdRequirements = pwdValidator.validate(req.body.input_pwd,  { list: true });
			console.log('Error: Failed password requirements: ' + failedPwdRequirements);
			//res.setHeader('Content-Type', 'text/event-stream');
			res.status(400).send('Failed to meet password requirements: ' + failedPwdRequirements);
            return;
        }
        else {
			// Password from form is valid. Bcrypt the password
			bcrypt.hash(req.body.input_pwd, 10, function(err, hash) {
				// Store hash in password DB
				if (err) {
					console.log(err);
					//res.setHeader('Content-Type', 'text/event-stream');
					res.status(500).send(err);
					return;
				}
				else {
					pool.query("CALL changePwdByID(?,?)", [req.session.u_id, hash],
						function(mysql_err, result, fields) {
						if (mysql_err) {
							console.log(mysql_err);
							//res.setHeader('Content-Type', 'text/event-stream');
							res.status(500).send(mysql_err);
            				return;
						}
						else {
							//console.log(result);
							//res.setHeader('Content-Type', 'text/event-stream');
							res.status(200).send('Password changed successfully!');
							// must send some string for 'fetch' to process on the client side
						}
					});
				}
			});
			

		}
	}
);

// Router: PATCH '/changeEmail'
router.patch('/changeEmail',

	// check email format
	body('input_email').isEmail().withMessage('Must be an email address'),
	
	// sanitize email
	sanitizeBody('input_email').trim(),

	// validate user
	validateNormalUser,

	// Process request after validation and sanitization
	function(req, res) {
		
		const errorFormatter = ({ location, msg, param, value, nestedErrors }) => {
			return `${location}[${param}]: ${msg}`;
		};
		var validattion_errors = validationResult(req).formatWith(errorFormatter);

        if (!validattion_errors.isEmpty()) {
			// There is an email format errors
			console.log(validattion_errors.array().toString());
			//res.setHeader('Content-Type', 'text/event-stream');
			res.status(400).send(validattion_errors.array().toString());
            return;
        }
        else {

			// Check if new email address is available
			pool.query("CALL selectUserByEmail(?)", [req.body.input_email],
				function(err, result, fields) {
					if (err) {	// database returned error
						//res.setHeader('Content-Type', 'text/event-stream');
						res.status(500).send(err);
            			return;
					}
					else if (result[0].length > 0) {	// email already exists
						res.status(409).send("Email address unavailable");
            			return;
					}
					else {	// process the email change in the database
						//console.log(result);
						pool.query("CALL changeEmailByID(?,?)", [req.session.u_id, req.body.input_email],
							function(change_email_err, change_email_result, change_email_fields) {
								if (change_email_err) {	// database returned error
									//res.setHeader('Content-Type', 'text/event-stream');
									res.status(500).send(change_email_err);
            						return;
								}
							else {	// successful
								//console.log(change_email_result);
								//res.setHeader('Content-Type', 'text/event-stream');
								res.status(200).send('Email changed successfully!');
								// must send some string for 'fetch' to process on the client side
							}
						});
					}
			});
			

		}
	}
);

// Router: GET '/'
router.get('/', validateNormalUser, function(req, res) {

	// Format the creation timestamp
	//console.log(req.session.creation_datetime);
	var creation_datetime_formatted = moment(req.session.creation_datetime).format('llll');
	//console.log(creation_datetime_formatted);

	// Calculate the number of days since registration
	var now_in_pacific = moment.tz(new Date(), 'US/Pacific');
	var creation_datetime_in_pacific = moment.tz(req.session.creation_datetime, 'US/Pacific');
	var days = now_in_pacific.diff(creation_datetime_in_pacific, 'days');
	//console.log(days);

	// Store the signature to be inserted to the .hbs html file
	var signature_inserted_to_html = '';

	if (signature_local) {	// signature is not Null
		signature_inserted_to_html = '<img class="img-fluid" src="' + signature_local + '"/>';
	} else {	// signature is Null
		signature_inserted_to_html = 'No signature on file.';
	}

	// Import user-created awards
	var user_num_of_awards = 0;

	console.log("checking Award db");
	pool.query("CALL selectAwardByUserID(?)", [req.session.u_id], function(err, award_result, fields) {

		if (err) {	// Database connection error
			console.log(err);
			res.render('users_error', {
				title: 'User Account - Error',
				error_message: 'Award table connection failed.',
				redirect_message: 'Logging out in 5 seconds.',
				redirect_location: '/logout',
				timeout_ms: 5000
			});
		}
		else {
			user_num_of_awards = award_result[0].length;
		}

	});
	

	var context = {};
	context = {
		title: 'User Account',
		session: {
			email: req.session.email,
			fname: req.session.fname,
			lname: req.session.lname,
			timestamp: creation_datetime_formatted,
			signature: signature_inserted_to_html,
			elapsed_days: days,
			num_of_awards: user_num_of_awards
		},
		showProfileTab: 1,
		//customHeader: '<script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>',
		customScript: '<script src="https://cdn.jsdelivr.net/npm/signature_pad@2.3.2/dist/signature_pad.min.js"></script>\n' +
			'<script src="/public/scripts/normalUser/userProfileFunctions.js"></script>\n' +
			'<script src="/public/scripts/normalUser/createAwardFunction.js"></script>\n',
	};

	if (req.query.tab == 'awards') { // use /users?tab=awards in the URL to first display the awards tab
		context.showProfileTab = 0;
	}

	console.log("Exectuing user page rendering");
	res.render('users.hbs', context);
});


module.exports = router;
