const express = require('express')
const app = express()
var bodyParser = require('body-parser')
var cors = require('cors')
const knex = require('knex')

const db = knex({
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: true,
    }
  });


const database = {
    logins: [
        {
            login: 'egolf',
            password: 'password'
        }
    ]
}

dateToString = (date) => {
    dateString = '';
    dateString = (parseInt(date.getYear()) + 1900).toString() + '-' + (parseInt(date.getMonth()) + 1).toString() + '-' + date.getDate();
    return dateString;
}

app.use(cors());
app.use(bodyParser.json());
app.get('/', (req, res) => res.send('it is working'))

app.post('/signin', (req, res) => {
    if (req.body.login === database.logins[0].login && 
        req.body.password === database.logins[0].password) {
            res.json(database.logins[0]);
    } else {
        res.status(400).json('error logging in');
    } 
})

app.get('/calendar', (req, res) => {
    db.select('*').from('reservations').orderByRaw('start_time')
        .then(reservation => {
            if (reservation.length) {
                res.json(reservation)
            } else {
                res.status(400).json('No Reservations for the Week')
            }
        })
})

app.get('/viewreservation_day/:reservation_day', (req, res) => {
    const {reservation_day} = req.params;
    db.select('*').from('reservations').where({reservation_day}).orderByRaw('start_time')
        .then(reservation => {
            if (reservation.length) {
                res.json(reservation)        
            } else {
                res.status(400).json('No Reservations on Selected Date')
            }
    })
    .catch(err => res.status(400).json('Error Getting Reservations'))
})

app.post('/newreservation', (req, res) => {
    const {name, phone, start_time, group_size, reservation_day} = req.body;
    console.log('If statement boolean ' + !name|| !start_time || !group_size || !reservation_day)
    if (!name|| !start_time || !group_size || !reservation_day) {
        return res.status(400).json('missing fields')
    } else {
        split_start = start_time.split(':');
        end_time = (parseInt(split_start[0])+parseInt(group_size)).toString() + ':' + split_start[1];
        stationArray = [1,2,3,4,5,6];
        console.log("Made it to station array")
        db.select('*').from('reservations').where({reservation_day})
            .then(reservation => {
                reservation.forEach(res => {
                    if ((start_time + ':00' < res.end_time && start_time + ':00' >= res.start_time) || 
                        (end_time + ':00' <= res.end_time && end_time + ':00' > res.start_time)) {
                            if (stationArray.indexOf(res.station) >= 0) {
                                console.log("Splicing stationArray")
                                stationArray.splice(stationArray.indexOf(res.station),1)
                            }
                    }
                })
            })
        .then(() => {
            console.log("stationArray length " + stationArray.length)
            if (stationArray.length > 0) {
                console.log("stationArray passed")
                db('reservations')
                    .returning('*')
                    .insert ({
                        name: name,
                        phone: phone,
                        group_size: group_size,
                        start_time: start_time,
                        end_time: end_time,
                        reservation_day: reservation_day,
                        station: stationArray[0],
                    })
                    .then(reservation => {
                        res.json(reservation[0]);
                    })
            } else {
                return res.status(400).json('no station')
            }
        });
    }
})

app.put('/changereservation', (req, res) => {
    const {name, phone, start_time, group_size, reservation_day, station, reservation_id} = req.body;
    split_start = start_time.split(':');
    end_time = (parseInt(split_start[0])+parseInt(group_size)).toString() + ':' + split_start[1];
    validChange = true;
    db.select('*').from('reservations').where({reservation_day})
        .then(reservation => {
            reservation.forEach(res => {
                if (reservation_id !== res.id) {
                if ((start_time + ':00' < res.end_time && start_time + ':00' >= res.start_time) || 
                    (end_time + ':00' <= res.end_time && end_time + ':00' > res.start_time)) {
                    if (station === res.station) {
                        validChange = false;
                        }
                    }
                }
            })
        }).then( () => {
            if (validChange) {
                db('reservations').where('id', '=', reservation_id)
                    .update({
                        name: name,
                        phone: phone,
                        group_size: group_size,
                        reservation_day: reservation_day,
                        start_time: start_time,
                        end_time: end_time,
                        station: station
                    }).then( () => {
                        res.json('reservation updated');
                    })
                    .catch(err => res.status(400).json('unable to get reservation'))
            } else {
                res.json('Conflicting reservation exists');
            }
        })
})

app.delete('/delete', (req, res) => {
    const{reservation_id} = req.body;
    db('reservations').del().where('id', '=', reservation_id)
        .then(() => {
            res.json('reservation deleted')
        })
        .catch(err => res.status(400).json('unable to get reservation'))
})

app.get('/customer/:name', (req, res) => {
    const{name} = req.params;
    db.select('*').from('customers').where({name})
        .then(customer => {
            if (customer.length) {
                res.json(customer)
            } else {
                res.status(400).json('Can\'t find customer')
            }
        })
        .catch(err => res.status(400).json('Error finding customer'))
})

app.listen(process.env.PORT || 3000, () => {
    console.log('app is running on port ${process.env.PORT}');
})



/*
/root--> res = full database of reservations
/signin --> POST success/fail
/calendar --> GET reservations for the week
/selectreservation_day --> POST date to look up
/viewreservation_day --> GET reservations for one reservation_day
/new reservation --> POST new reservation
/change reservation --> PUT update reservation
/delete reservation --> DELETE reservation
/customer info --> GET info
*/

/*
/Make reservation rules: 
/---------------1 hr per group_size #
/---------------Assign to empty station. Auto-populate to see what it is and edit if desired
/---------------Make weekly or bi-weekly !!!!! in component as option or logic on back-end if pattern is spotted?
/---------------Confirms reservation made or share error
/Change reservation rules:
/---------------Swap station - show options
/---------------Change time, group_size, etc
/---------------Confirm changed or error
/
*/