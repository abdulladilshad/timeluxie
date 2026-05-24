const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express')
const app = express()
const Path = require('path')

require('dotenv').config()

const mongoose = require('mongoose')
const connectDb = require('./ConnectDb/db')

const user = require('./routers/user')
const admin = require('./routers/admin')

const passport = require('./ConnectDb/passport')

const nocache = require('nocache')
const session = require('express-session')
const MongoStore = require('connect-mongo')

const morgan = require('morgan')
const flash = require('connect-flash')

console.log("MAIN ENV =", process.env.MONGODB_URI)

// CONNECT DATABASE
connectDb()

// app.set('views', Path.join(__dirname, 'views'))
// app.set('view engine', 'ejs')

app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(express.json({ limit: '50mb' }))

app.use(express.static('public'))

app.use(morgan('dev'))

app.use(nocache())

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,

    store: MongoStore.create({
        client: mongoose.connection.getClient()
    }),

    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}))

app.use(passport.initialize())
app.use(passport.session())

app.use(flash())

app.use('/', user)
app.use('/admin', admin)

app.use((req, res, next) => {
    res.locals.error_msg = req.flash('error')
    next()
})

app.use((req, res, next) => {
    res.status(404).send('Does not Exist')
})

app.listen(process.env.PORT, () => {
    console.log(`PORT connected in http://localhost:${process.env.PORT}`)
})