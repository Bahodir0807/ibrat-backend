const TEACHER_PASSWORD = 'Teacher123!';
const STUDENT_PASSWORD = 'Student123!';
const OWNER_PASSWORD = 'TempOwner123!';

const tempOwner = {
  fullName: 'Temporary Owner',
  firstName: 'Temporary',
  lastName: 'Owner',
  username: 'temp_owner_test',
  password: OWNER_PASSWORD,
  role: 'owner',
};

const teacher = {
  fullName: 'Sultonovo',
  firstName: 'Sultonovo',
  lastName: '',
  username: 'sultonovo',
  password: TEACHER_PASSWORD,
  role: 'teacher',
};

const students = [
  'Ali Karimov',
  'Bekzod Rustamov',
  'Jahongir Sobirov',
  'Abdulloh Xasanov',
  'Asilbek Tursunov',
  'Nodirbek Ergashev',
  'Azizbek Rakhimov',
  'Diyorbek Usmonov',
  'Islombek Qodirov',
  'Sardor Mirzayev',
  'Muhammadali Yoqubov',
  'Akmaljon Ismoilov',
  'Shohruh Abduvaliyev',
  'Ibrohim Fayziyev',
  'Mirjalol Nurmatov',
].map((fullName, index) => {
  const [firstName, ...rest] = fullName.split(' ');
  return {
    fullName,
    firstName,
    lastName: rest.join(' '),
    username: `student${String(index + 1).padStart(2, '0')}`,
    password: STUDENT_PASSWORD,
    role: 'student',
  };
});

const courses = [
  {
    name: 'Math Course',
    price: 400000,
    studentIndexes: [0, 1, 2, 3, 4],
  },
  {
    name: 'IT and IT Technologies',
    price: 800000,
    studentIndexes: [5, 6, 7, 8, 9],
  },
  {
    name: 'Computer Basics',
    price: 400000,
    studentIndexes: [10, 11, 12, 13, 14],
  },
];

const paymentStatuses = ['pending', 'confirmed', 'cancelled'];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function isLocalBaseUrl(value) {
  const url = new URL(value);
  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function unwrapResponse(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

function toId(value) {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    return String(value.id ?? value._id ?? '');
  }
  return String(value);
}

function ids(values) {
  return (values ?? []).map(toId).filter(Boolean);
}

function hasSameIds(currentValues, expectedIds) {
  const current = new Set(ids(currentValues));
  return expectedIds.every(id => current.has(id)) && current.size === expectedIds.length;
}

function formatQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

class DemoApi {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = undefined;
  }

  async request(method, path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : undefined;
    const data = unwrapResponse(payload);

    if (!response.ok) {
      const message = data?.message ?? payload?.error?.message ?? payload?.message ?? text;
      const error = new Error(`${method} ${path} failed (${response.status}): ${message}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return data;
  }

  get(path, params = {}) {
    return this.request('GET', `${path}${formatQuery(params)}`);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  patch(path, body) {
    return this.request('PATCH', path, body);
  }

  async login(username, password) {
    const data = await this.post('/auth/login', { username, password });
    this.token = data.accessToken ?? data.token;
    if (!this.token) {
      throw new Error('Login response did not include an access token');
    }
  }
}

async function findUserByUsername(api, username) {
  try {
    return await api.get('/users/search', { username });
  } catch (error) {
    if (error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

async function ensureUser(api, user) {
  const existing = await findUserByUsername(api, user.username);
  if (existing) {
    return { record: existing, status: 'reused' };
  }

  const created = await api.post('/users', {
    username: user.username,
    password: user.password,
    role: user.role,
    status: 'active',
    firstName: user.firstName,
    lastName: user.lastName ?? '',
  });

  return { record: created, status: 'created' };
}

async function findByName(api, path, name, extraParams = {}) {
  const records = await api.get(path, {
    search: name,
    limit: 100,
    ...extraParams,
  });

  return (records ?? []).find(record => record.name === name);
}

async function ensureCourse(api, course, teacherId, studentIds) {
  const existing = await findByName(api, '/courses', course.name);
  const payload = {
    name: course.name,
    description: `Demo course: ${course.name}`,
    price: course.price,
    teacherIds: [teacherId],
    students: studentIds,
  };

  if (!existing) {
    return { record: await api.post('/courses', payload), status: 'created' };
  }

  const existingTeacherIds = Array.isArray(existing.teacherIds)
    ? existing.teacherIds.map(toId)
    : (existing.teacherId ? [toId(existing.teacherId)] : []);
  const needsUpdate =
    existing.price !== course.price
    || existingTeacherIds.length !== 1
    || existingTeacherIds[0] !== teacherId
    || !hasSameIds(existing.students, studentIds);

  if (!needsUpdate) {
    return { record: existing, status: 'reused' };
  }

  return { record: await api.patch(`/courses/${existing.id}`, payload), status: 'updated' };
}

async function ensureGroup(api, course, courseRecord, teacherId, studentIds) {
  const name = `${course.name} Demo Group`;
  const existing = await findByName(api, '/groups', name, { courseId: courseRecord.id });
  const payload = {
    name,
    course: courseRecord.id,
    teacher: teacherId,
    students: studentIds,
  };

  if (!existing) {
    return { record: await api.post('/groups', payload), status: 'created' };
  }

  const needsUpdate =
    toId(existing.course) !== courseRecord.id
    || toId(existing.teacher) !== teacherId
    || !hasSameIds(existing.students, studentIds);

  if (!needsUpdate) {
    return { record: existing, status: 'reused' };
  }

  return { record: await api.patch(`/groups/${existing.id}`, payload), status: 'updated' };
}

async function ensurePayment(api, studentId, courseId, desiredStatus, method) {
  const existing = (await api.get('/payments', {
    studentId,
    courseId,
    limit: 1,
  }))[0];

  let payment = existing;
  let status = existing ? 'reused' : 'created';

  if (!payment) {
    payment = await api.post('/payments', {
      student: studentId,
      courseId,
      paidAt: new Date().toISOString(),
      method,
    });
  }

  if (desiredStatus === 'confirmed' && payment.status !== 'confirmed') {
    payment = await api.patch(`/payments/${payment.id}/confirm`);
    status = status === 'created' ? 'created+confirmed' : 'updated';
  }

  if (desiredStatus === 'cancelled' && payment.status !== 'cancelled') {
    payment = await api.patch(`/payments/${payment.id}/cancel`);
    status = status === 'created' ? 'created+cancelled' : 'updated';
  }

  return { record: payment, status };
}

function printCredentialSummary(courseAssignments) {
  console.log('');
  console.log('====================================');
  console.log('DEMO USERS CREATED');
  console.log('====================================');
  console.log('');
  console.log('Owner:');
  console.log(`${tempOwner.username} / ${tempOwner.password}`);
  console.log('');
  console.log('Teacher:');
  console.log(`${teacher.username} / ${teacher.password}`);
  console.log('');
  console.log('Students:');

  for (const item of courseAssignments) {
    console.log('');
    console.log(item.student.fullName);
    console.log(`username: ${item.student.username}`);
    console.log(`password: ${item.student.password}`);
    console.log(`course: ${item.course.name}`);
    console.log(`group: ${item.group.name}`);
  }
  console.log('');
}

function printOperationSummary(summary) {
  console.log('Operation summary:');
  for (const item of summary) {
    console.log(`- ${item.type}: ${item.name} (${item.status})`);
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(requiredEnv('DEMO_API_BASE_URL'));
  if (!isLocalBaseUrl(baseUrl) && process.env.DEMO_ALLOW_PRODUCTION !== 'true') {
    throw new Error(
      'DEMO_API_BASE_URL does not look local. Set DEMO_ALLOW_PRODUCTION=true to run against this API.',
    );
  }

  const adminUsername = requiredEnv('DEMO_ADMIN_USERNAME');
  const adminPassword = requiredEnv('DEMO_ADMIN_PASSWORD');
  const createPayments = process.env.DEMO_CREATE_PAYMENTS === 'true';
  const api = new DemoApi(baseUrl);
  const summary = [];
  const assignments = [];

  await api.login(adminUsername, adminPassword);
  console.log(`Logged in to ${baseUrl} as ${adminUsername}`);

  const ownerResult = await ensureUser(api, tempOwner);
  summary.push({ type: 'owner', name: tempOwner.username, status: ownerResult.status });

  const teacherResult = await ensureUser(api, teacher);
  const teacherRecord = teacherResult.record;
  summary.push({ type: 'teacher', name: teacher.username, status: teacherResult.status });

  const studentResults = [];
  for (const student of students) {
    const result = await ensureUser(api, student);
    studentResults.push({ student, record: result.record });
    summary.push({ type: 'student', name: student.username, status: result.status });
  }

  for (const course of courses) {
    const courseStudents = course.studentIndexes.map(index => studentResults[index]);
    const studentIds = courseStudents.map(item => item.record.id);
    const courseResult = await ensureCourse(api, course, teacherRecord.id, studentIds);
    summary.push({ type: 'course', name: course.name, status: courseResult.status });

    const groupResult = await ensureGroup(api, course, courseResult.record, teacherRecord.id, studentIds);
    summary.push({ type: 'group', name: groupResult.record.name, status: groupResult.status });

    for (const item of courseStudents) {
      assignments.push({
        student: item.student,
        course,
        group: groupResult.record,
      });
    }

    if (createPayments) {
      for (const [index, item] of courseStudents.entries()) {
        const desiredStatus = paymentStatuses[index % paymentStatuses.length];
        const paymentResult = await ensurePayment(
          api,
          item.record.id,
          courseResult.record.id,
          desiredStatus,
          index % 2 === 0 ? 'cash' : 'card',
        );
        summary.push({
          type: 'payment',
          name: `${item.student.username} / ${course.name} / ${desiredStatus}`,
          status: paymentResult.status,
        });
      }
    }
  }

  printOperationSummary(summary);
  printCredentialSummary(assignments);
}

main().catch(error => {
  console.error(`Demo data creation failed: ${error.message}`);
  process.exitCode = 1;
});
