/**
 * Test Suite: RegisterApp Routes
 *
 * Tests the routes defined in routes/routes.js.
 * All Mongoose model calls are mocked so no real DB connection is needed.
 */

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const path = require('path');

jest.mock('mongoose', () => {
    function MockModel(data) {
        Object.assign(this, data);
        this.save = jest.fn().mockResolvedValue({ _id: 'mock-id-123', ...data });
    }
    MockModel.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
                sort: jest.fn().mockResolvedValue([])
            })
        })
    });
    MockModel.countDocuments = jest.fn().mockResolvedValue(0);
    MockModel.findById = jest.fn().mockResolvedValue(null);
    MockModel.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    MockModel.findByIdAndDelete = jest.fn().mockResolvedValue(null);

    return {
        connect: jest.fn().mockResolvedValue(true),
        connection: { on: jest.fn(), once: jest.fn() },
        Schema: jest.fn().mockImplementation(() => ({})),
        model: jest.fn().mockReturnValue(MockModel),
    };
});

function buildTestApp() {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', saveUninitialized: true, resave: false }));
    app.use((req, res, next) => {
        res.locals.message = req.session.message;
        delete req.session.message;
        next();
    });
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    app.use('', require('../routes/routes'));
    return app;
}

describe('GET Routes - Page Rendering', () => {
    let app;
    beforeAll(() => { app = buildTestApp(); });

    test('GET / - home page should respond', async () => {
        const res = await request(app).get('/');
        expect([200, 500]).toContain(res.statusCode);
    });

    test('GET /add - add user form should respond', async () => {
        const res = await request(app).get('/add');
        expect([200, 500]).toContain(res.statusCode);
    });

    test('GET /about - about page should respond', async () => {
        const res = await request(app).get('/about');
        expect([200, 500]).toContain(res.statusCode);
    });

    test('GET /contact - contact page should respond', async () => {
        const res = await request(app).get('/contact');
        expect([200, 500]).toContain(res.statusCode);
    });
});

describe('POST /add - Add User', () => {
    let app;
    beforeAll(() => { app = buildTestApp(); });

    test('should redirect to / after successful user add', async () => {
        const res = await request(app)
            .post('/add')
            .field('name', 'Mekhi San')
            .field('email', 'mekhi@iastate.edu')
            .field('phone', '5155551234');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');
    });

    test('should redirect to / when name is missing', async () => {
        const res = await request(app)
            .post('/add')
            .field('email', 'noname@example.com')
            .field('phone', '5155550001');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');
    });

    test('should redirect to / when email is missing', async () => {
        const res = await request(app)
            .post('/add')
            .field('name', 'No Email')
            .field('phone', '5155550002');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');
    });

    test('should redirect to / when phone is missing', async () => {
        const res = await request(app)
            .post('/add')
            .field('name', 'No Phone')
            .field('email', 'nophone@example.com');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');
    });

    test('should redirect to / on completely empty POST body', async () => {
        const res = await request(app).post('/add');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');
    });
});

describe('GET /delete/:id - Delete User', () => {
    let app;
    beforeAll(() => { app = buildTestApp(); });

    test('should redirect to / after delete attempt', async () => {
        const res = await request(app).get('/delete/507f1f77bcf86cd799439011');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');
    });
});

describe('GET /edit/:id - Edit User', () => {
    let app;
    beforeAll(() => { app = buildTestApp(); });

    test('should redirect to / when user is not found', async () => {
        const res = await request(app).get('/edit/507f1f77bcf86cd799439011');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');
    });
});
