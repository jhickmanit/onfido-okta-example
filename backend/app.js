var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var  cors = require('cors');

var indexRouter = require('./routes/index');


var app = express();

const sess = {
  secret: process.env.APP_SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: false },
};

const corsOptions = {
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200,
  credentials: true,
};

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session(sess));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors(corsOptions));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/api', indexRouter);

module.exports = app;
