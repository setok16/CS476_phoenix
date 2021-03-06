﻿var mysql = require('../dbcon.js');
var auth = require('../routes/adminAuth');
var pool = mysql.pool;
var express = require('express');
var router = express.Router();


router.all('/*', auth.adminUser);

router.get('/users/:resulttype',
	function(req, res, next) {

		if (req.params.resulttype.toLowerCase() === 'chartdata') {
			//create array and set headers
			var googleChartData = [];

			googleChartData.push([
				{ id: "u_type", label: "User Type", type: "string" },
				{ id: "total", label: "Total", type: "number" }
			]);

			pool.query("SELECT u_type, count(u_id) as Total from User Group by u_type",
				function (err, rows) {
					if (err) {
						console.log(err);
					} else {
						rows.forEach(function (element) {
							googleChartData.push([element.u_type, element.Total]);
						});
						res.send(googleChartData);
					}
				});
		} else if (req.params.resulttype.toLowerCase() === 'table') {
			//create array and set headers
			var googleTabletData = [];

			googleTabletData.push([
				{ id: "email", label: "Email", type: "string" },
				{ id: "fname", label: "First Name", type: "string" },
				{ id: "lname", label: "Last Name", type: "string" },
				{ id: "u_type", label: "User Type", type: "string" },
				{ id: "domain", label: "User Domain", type: "string" }
			]);

			pool.query(
				"SELECT email, lname, fname, u_type, creation_datetime from User ORDER BY email;",
				function(err, rows) {
					if (err) {
						console.log(err);
					} else {
						rows.forEach(function (element) {
							googleTabletData.push([element.email, element.lname, element.fname, element.u_type, GetEmailParts(element.email).domain ]);
						});
						res.send(googleTabletData);
					}
				});
		} else {
			res.send([]);
		}
	});

router.get('/awards/:resulttype',
	function(req, res, next) {
		if (req.params.resulttype.toLowerCase() === 'table') {

		var googleTabletData = [];

		googleTabletData.push([
			{ id: 'receiver_fullname', label: 'Recipient', type: 'string' },
			{ id: 'receiver_email', label: 'Recipient Email', type: 'string' },
			{ id: 'c_type', label: 'Award Type', type: 'string' },
			{ id: 'issuer', label: 'Issuer', type: 'string' },
			{ id: 'issuer_email', label: 'Issuer Email', type: 'string' },
			{ id: 'granted_datetime', label: 'Date Granted', type: 'date' },
			{ id: "domain", label: "Recipient Domain", type: "string" },
			{ id: "issuer_domain", label: "Issuer Domain", type: "string" }
		]);
			
		pool.query(
			"SELECT receiver_email, receiver_lname, receiver_fname, c_type, YEAR(CONVERT_TZ(granted_datetime,'UTC', 'US/Pacific')) as granted_year, MONTH(CONVERT_TZ(granted_datetime,'UTC', 'US/Pacific')) - 1 as granted_month, DAY(CONVERT_TZ(granted_datetime,'UTC', 'US/Pacific')) as granted_day, u.fname, u.lname, u.email " +
			"FROM Award a " +
			"LEFT JOIN User u on a.user_id = u.u_id " +
			"ORDER BY a.receiver_lname;",
			function (err, rows) {
				if (err) {
					console.log(err);
				} else {
					rows.forEach(function (element) {
						googleTabletData.push([
							element.receiver_fname + " " + element.receiver_lname
							, element.receiver_email
							, element.c_type
							, element.fname + " " + element.lname
							, element.email
							, 'Date('+element.granted_year+','+element.granted_month+','+element.granted_day+')'
							, GetEmailParts(element.receiver_email).domain
							, GetEmailParts(element.email).domain]);
					});
					res.send(googleTabletData);
				}
			});
		} else if (req.params.resulttype.toLowerCase() === 'domain') {

			var googleTabletData = [];
			googleTabletData.push([
				{ id: "domain", label: "User Domain", type: "string" },
				{ id: 'c_type', label: 'Award Type', type: 'string' },
				{ id: 'granted_datetime', label: 'Granted', type: 'date' }
			]);

			pool.query(
				"SELECT receiver_email, " +
				"c_type, " +
				"YEAR(CONVERT_TZ(granted_datetime,'UTC', 'US/Pacific')) as granted_year, MONTH(CONVERT_TZ(granted_datetime,'UTC', 'US/Pacific')) - 1 as granted_month, DAY(CONVERT_TZ(granted_datetime,'UTC', 'US/Pacific')) as granted_day  " +
				"FROM Award a ",
				function (err, rows) {
					if (err) {
						res.send(err);
					} else {
						rows.forEach(function (element) {
							googleTabletData.push([
								GetEmailParts(element.receiver_email).domain,
								element.c_type,
								'Date(' + element.granted_year + ',' + element.granted_month + ',' + element.granted_day + ')'
							]);
						});
						res.send(googleTabletData);
					}
				});
	} else
	{
		res.send([]);
	}

});


function GetEmailParts(strEmail) {
	// Set up a default structure with null values 
	// incase our email matching fails.
	var objParts = {
		user: null,
		domain: 'unknown',
		ext: null
	};
	
	// Get the parts of the email address by leveraging
	// the String::replace method. Notice that we are 
	// matching on the whole string using ^...$ notation.
	if (strEmail) {
		strEmail.replace(
			new RegExp("^(.+)@(.+)\\.(\\w+)$", "i"),

			// Send the match to the sub-function.
			function($0, $1, $2, $3) {
				objParts.user = $1;
				objParts.domain = $2;
				objParts.ext = $3;
			}
		);
	}

	if (objParts.domain) {
		objParts.domain = objParts.domain.trim();
	}

	// Return the "potentially" updated parts structure.
	return (objParts);
}

module.exports = { router: router, getEmailParts: GetEmailParts }