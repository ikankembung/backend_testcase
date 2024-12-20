const express = require('express');  
const cors = require('cors');
const { Pool } = require('pg');  
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const app = express();  
const port = 8000;

app.use(cors({
    origin: "*"
}));

app.use(express.json()); 

const pool = new Pool({  
    user: 'bjbs_skenario_test_user',
    host: '172.31.202.205',
    database: 'bjbs_skenario_test',
    password: 'Bjbs2024!!!',
    port: 5432,
});

pool.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(e => console.error('Connection error', e.stack));

const validateId = (req, res, next) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID tidak valid' });
    }
    req.id = id;
    next();
};

app.get('/get_status', (req, res) => {
    pool.query('SELECT * FROM ref_status_testing ORDER BY id')  
        .then(result => res.send(result.rows))
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal mengambil data' });
        });
});

app.get('/applications', (req, res) => {
    pool.query('SELECT * FROM applications')
    .then(result => {
        console.log('Applications fetched:', result.rows); 
        res.json(result.rows);
    })
    .catch(e => {
        console.error(e);
        res.status(500).json({ message: 'Gagal mengambil data' });
    });
});

app.get('/applications_filter', (req, res) => {
    const { aplikasi } = req.query; 

    let query = `SELECT 
            app.*,
            rat.aplikasi as aplikasi
        FROM applications as app 
        LEFT JOIN ref_aplikasi_testing rat ON rat.id = app.application_id
        WHERE 1=1`; // Menambahkan WHERE 1=1 untuk memudahkan penambahan kondisi

    const params = [];

    if (aplikasi) { // Menggunakan 'aplikasi' yang benar
        query += ` AND rat.aplikasi ~* $${params.length + 1}`; // Menggunakan parameter untuk filter aplikasi
        params.push(aplikasi);
    }

    console.log('Query:', query); // Log query untuk debugging
    console.log('Params:', params); // Log params untuk debugging

    pool.query(query, params) 
        .then(result => {
            console.log('Result rows:', result.rows.length); // Log jumlah hasil
            res.json(result.rows);
        })
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal mengambil data' });
        });
});

app.post('/applications', 
    [
        check('test_cases_id').isInt().withMessage('Test Cases ID harus berupa angka'),
        check('success').isString().withMessage('Success harus berupa string'),
        check('review').isString().withMessage('Review harus berupa string'),
        check('bugs').isString().withMessage('Bugs harus berupa string'),
        check('failed').isString().withMessage('Failed harus berupa string'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { test_cases_id, success, review, bugs, failed } = req.body;
        pool.query('INSERT INTO applications (test_cases_id, success, review, bugs, failed) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
        [test_cases_id, success, review, bugs, failed])
            .then(result => res.status(201).send(result.rows[0]))
            .catch(e => {
                console.error(e);
                res.status(500).json({ message: 'Gagal membuat aplikasi' });
            });
    }
);

app.put('/applications/:id', validateId, (req, res) => {
    const { success, review, bugs, failed, pending } = req.body; 
    pool.query('UPDATE applications SET success = $1, review = $2, bugs = $3, failed = $4, pending = $5 WHERE id = $6 RETURNING *', 
    [success, review, bugs, failed, pending, req.id])
        .then(result => {
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Aplikasi tidak ditemukan' });
            }
            res.send(result.rows[0]);
        })
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal memperbarui aplikasi' });
        });
});

app.delete('/applications/:id', validateId, (req, res) => {
    pool.query('DELETE FROM applications WHERE id = $1', [req.id])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Aplikasi tidak ditemukan' });
            }
            res.status(204).send();
        })
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal menghapus aplikasi' });
        });
});

app.get('/test_cases/:id', validateId, (req, res) => {
    const { id } = req;
    pool.query('SELECT * FROM test_cases WHERE id = $1', [id]) 
        .then(result => {
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Test case tidak ditemukan' });
            }
            res.send(result.rows[0]);
        })
        .catch(e => {
            console.error('Error fetching test case:', e);
            res.status(500).json({ message: 'Gagal mengambil data test case' });
        });
});

app.get('/test_cases', (req, res) => {
    pool.query('SELECT tc.*, rst.status, rat.aplikasi FROM test_cases tc LEFT JOIN ref_status_testing rst ON rst.id = tc.status LEFT JOIN ref_aplikasi_testing rat ON rat.id = tc.application_id ORDER BY tc.created_at ASC')
        .then(result => res.send(result.rows))
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal mengambil data' });
        });
});

app.get('/test_cases_filter', (req, res) => {
    const { status, aplikasi } = req.query;
    
    
    console.log('Received query params:', { status, aplikasi });

    let query = `
        SELECT 
            tc.*,
            rst.status as status_name,
            rat.aplikasi as aplikasi
        FROM test_cases tc 
        LEFT JOIN ref_status_testing rst ON rst.id = tc.status 
        LEFT JOIN ref_aplikasi_testing rat ON rat.id = tc.application_id 
        WHERE 1=1
    `;
    
    const params = [];
    console.log("casing 1")
    console.log(status)
    
    
    if (status !== undefined && status !== '') {
        console.log("casing 2")
        query += ` AND tc.status = (SELECT id FROM ref_status_testing AS rst2 WHERE rst2.status ~* '${status}')`;
        
        console.log('Adding status filter:', status);
    }

    
    if (aplikasi !== undefined && aplikasi !== '') {
        query += ` AND tc.application_id = (SELECT id FROM ref_aplikasi_testing AS rat2 WHERE rat2.aplikasi ~* '${aplikasi}')`;
        
        console.log('Adding application filter:', aplikasi);
    }

    
    query += ' ORDER BY tc.id ASC';

    
    console.log('Final SQL Query:', query);
    console.log('Query Parameters:', params);

    pool.query(query, params)
        .then(result => {
            
            console.log('Query returned', result.rows.length, 'rows');
            res.json(result.rows);
        })
        .catch(error => {
            console.error('Database error:', error);
            res.status(500).json({
                message: 'Gagal mengambil data',
                error: error.message
            });
        });
});

app.post('/test_cases', 
    [
      check('application_id').isInt().withMessage('Application ID harus berupa angka'),
      check('title').isLength({ min: 1 }).withMessage('Title harus diisi'),
      check('description').isLength({ min: 1 }).withMessage('Deskripsi harus diisi'),
      check('status').isIn([1, 2, 3, 4, 5]).withMessage('Status tidak valid')
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
      }
      const { application_id, title, description, status } = req.body;
      const client = await pool.connect();
  
      try {
          await client.query('BEGIN');
  
const result = await client.query(
    `INSERT INTO test_cases (application_id, title, description, status, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`, 
    [application_id, title, description, status]
);
const testCase = result.rows[0]; 

const stepResult = await client.query(

    'INSERT INTO test_steps (test_cases_id, title, expected_result, actual_result, status, application_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',

    [testCase.id, title, description, '-', status, application_id]
);
const testStep = stepResult.rows[0];

await client.query(
    'INSERT INTO applications (test_cases_id, success, review, bugs, failed, pending, test_steps_id, application_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [testCase.id, status === 1 ? title : null, status === 2 ? title : null, status === 3 ? title : null, status === 4 ? title : null, status === 5 ? title : null, testStep.id, application_id] // Menambahkan application_id
);
  
          await client.query('COMMIT');
          res.status(201).send(testCase);
      } catch (e) {
          await client.query('ROLLBACK');
          console.error('Error creating test case:', e);
          res.status(500).json({ message: 'Gagal membuat test case' });
      } finally {
          client.release();
      }
  });

  app.put('/test_cases/:id', validateId, async (req, res) => {
    const { title, description, status, application_id } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            'UPDATE test_cases SET title = $1, description = $2, status = $3, application_id = $4 WHERE id = $5 RETURNING *', 
            [title, description, status, application_id, req.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Test case tidak ditemukan' });
        }

        const updatedTestCase = result.rows[0];

        const stepResult = await client.query(
            'UPDATE test_steps SET title = $1, expected_result = $2, actual_result = $3, status = $4, application_id = $5, updated_at = CURRENT_TIMESTAMP WHERE test_cases_id = $6 RETURNING *',
            [title, description, '-', status, application_id, req.id]
        );

        const updatedStep = stepResult.rows[0];

        await client.query(
            'UPDATE applications SET success = $2, review = $3, bugs = $4, failed = $5, pending = $6, test_steps_id = $7, application_id = $8 WHERE test_cases_id = $1 RETURNING *',
            [application_id, status === 1 ? title : null, status === 2 ? title : null, status === 3 ? title : null, status === 4 ? title : null, status === 5 ? title : null, updatedStep.id, application_id]
        );

        await client.query('COMMIT');
        res.send(updatedTestCase);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'Gagal memperbarui test case' });
    } finally {
        client.release();
    }
});

app.delete('/test_cases/:id', validateId, (req, res) => {
    pool.query('DELETE FROM test_cases WHERE id = $1', [req.id])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Test case tidak ditemukan' });
            }
            res.status(204).send();
        })
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal menghapus test case' });
        });
});

app.get('/test_steps', (req, res) => {
    pool.query('SELECT ts.*, rst.status, rat.aplikasi FROM test_steps ts LEFT JOIN ref_status_testing rst ON rst.id = ts.status LEFT JOIN ref_aplikasi_testing rat ON rat.id = ts.application_id ORDER BY ts.created_at ASC')
        .then(result => res.send(result.rows))
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal mengambil data' });
        });
});

app.get('/test_steps/:id', validateId, (req, res) => {
    pool.query('SELECT * FROM test_steps WHERE id = $1', [req.id])
        .then(result => {
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Test step tidak ditemukan' });
            }   
            res.send(result.rows[0]);
        })
        .catch(e => {
            console.error('Error fetching test step:', e);
            res.status(500).json({ message: 'Gagal mengambil data test step' });
        });
});

app.get('/test_steps_filter', (req, res) => {
    const { status, test_cases_id } = req.query; 

    let query = 'SELECT ts.*, rst.status, rat.aplikasi FROM test_steps ts LEFT JOIN ref_status_testing rst ON rst.id = ts.status LEFT JOIN ref_aplikasi_testing rat ON rat.id = ts.application_id WHERE 1=1';
    const params = [];

    if (status) {
        query += ` AND rst.status = $${params.length + 1}`; 
        params.push(status);
    }

    if (test_cases_id) {
        query += ` AND ts.test_cases_id = $${params.length + 1}`; 
        params.push(test_cases_id);
    }

    query += ' ORDER BY ts.created_at ASC'; 

    pool.query(query, params) 
        .then(result => res.send(result.rows))
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal mengambil data' });
        });
});

app.post('/test_steps', 
  [check('description').isLength({ min: 1 }).withMessage('Deskripsi harus diisi'),
   check('test_cases_id').isInt().withMessage('Test Cases ID harus berupa angka')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { description, test_cases_id, status } = req.body; 
    const validStatuses = [1, 2, 3, 4, 5]; 

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Status tidak valid' });
    }

    const checkTestCase = await pool.query(
        'SELECT * FROM test_cases WHERE id = $1',
        [test_cases_id]
    );

    if (checkTestCase.rows.length === 0) {
        return res.status(400).json({ message: 'Test Cases ID tidak valid' });
    }

    pool.query(
        'INSERT INTO test_steps (description, test_cases_id, status) VALUES ($1, $2, $3) RETURNING *', 
        [description, test_cases_id, status]
    )
    .then(result => res.status(201).send(result.rows[0]))
    .catch(e => {
        console.error(e);
        res.status(500).json({ message: 'Gagal membuat test step' });
    });
});

app.put('/test_steps/:id', validateId, async (req, res) => {
    const { title, expected_result, actual_result, status, test_cases_id, application_id } = req.body; // Ambil application_id dari body
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            'UPDATE test_steps SET title = $1, expected_result = $2, actual_result = $3, status = $4, application_id = $5 WHERE id = $6 RETURNING *', 
            [title, expected_result, actual_result, status, application_id, req.id] // Menggunakan application_id yang diambil dari body
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Test step tidak ditemukan' });
        }

        const updatedStep = result.rows[0];

        const testCaseResult = await client.query(
            'UPDATE test_cases SET title = $1, description = $2, status = $3 WHERE id = $4 RETURNING *',
            [title, expected_result, status, test_cases_id] 
        );

        if (testCaseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Test case tidak ditemukan' });
        }

        const updatedTestCase = testCaseResult.rows[0];

        const resultCase = await client.query(
            'SELECT application_id FROM test_cases WHERE id = $1',
            [test_cases_id]
        );

        if (resultCase.rows.length > 0) {
            const application_id = resultCase.rows[0].application_id; // Mendapatkan application_id dari test_cases

            await client.query(
                'UPDATE applications SET success = $2, review = $3, bugs = $4, failed = $5, pending = $6, test_steps_id = $7, application_id = $8 WHERE test_cases_id = $1 RETURNING *',
                [test_cases_id, status === 1 ? title : null, status === 2 ? title : null, status === 3 ? title : null, status === 4 ? title : null, status === 5 ? title : null, updatedStep.id, application_id] 
            );
        }

        await client.query('COMMIT');
        res.send({ updatedStep, updatedTestCase }); 
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ message: 'Gagal memperbarui test step' });
    } finally {
        client.release();
    }
});

app.delete('/test_steps/:id', validateId, (req, res) => {
    pool.query('DELETE FROM test_steps WHERE id = $1', [req.id])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Test step tidak ditemukan' });
            }
            res.status(204).send();
        })
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal menghapus test step' });
        });
});

app.get('/users', (req, res) => {
    pool.query('SELECT * FROM users')
        .then(result => res.send(result.rows))
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal mengambil data' });
        });
});

app.post('/users', 
  [
    check('username').isLength({ min: 1 }).withMessage('Username harus diisi'),
    check('password').isLength({ min: 6 }).withMessage('Password harus minimal 6 karakter'),
    check('role').isLength({ min: 1 }).withMessage('minimal ada role')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { username, password, role } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *', [username, hashedPassword, role]);
        res.status(201).send(result.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Gagal membuat user' });
    }
});

app.put('/users/:id', validateId, (req, res) => {
    const { username, password } = req.body;
    bcrypt.hash(password, 10)
        .then(hashedPassword => {
            pool.query(
                'UPDATE users SET username = $1, password = $2 WHERE id = $3 RETURNING *', 
                [username, hashedPassword, req.id]
            )
            .then(result => {
                if (result.rows.length === 0) {
                    return res.status(404).json({ message: 'User tidak ditemukan' });
                }
                res.send(result.rows[0]);
            })
            .catch(e => {
                console.error(e);
                res.status(500).json({ message: 'Gagal memperbarui user' });
            });
        })
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal meng-hash password' });
        });
});

app.delete('/users/:id', validateId, (req, res) => {
    pool.query('DELETE FROM users WHERE id = $1', [req.id])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'User tidak ditemukan' });
            }
            res.status(204).send();
        })
        .catch(e => {
            console.error(e);
            res.status(500).json({ message: 'Gagal menghapus user' });
        });
});

app.post('/users/login', 
  [
    check('username').isLength({ min: 1 }).withMessage('Username harus diisi'),
    check('password').isLength({ min: 6 }).withMessage('Password harus diisi')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Username atau password salah' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: 'Username atau password salah' });
        }

        res.json({ message: 'Login berhasil', user: { id: user.id, username: user.username, role: user.role } });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Gagal melakukan login' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server berjalan di http://172.31.202.237:${port}`);
});