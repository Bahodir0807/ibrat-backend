const TEACHER_PASSWORD = 'Teacher123!';
const STUDENT_PASSWORD = 'Student123!';

const teacher = {
  fullName: 'Sultonovo',
  firstName: 'Sultonovo',
  lastName: '',
  username: 'sultonovo',
  password: TEACHER_PASSWORD,
  role: 'teacher',
};

const students = [
  ['Ali Karimov', 'student01', 'Math Course'],
  ['Bekzod Rustamov', 'student02', 'Math Course'],
  ['Jahongir Sobirov', 'student03', 'Math Course'],
  ['Abdulloh Xasanov', 'student04', 'Math Course'],
  ['Asilbek Tursunov', 'student05', 'Math Course'],
  ['Nodirbek Ergashev', 'student06', 'IT and IT Technologies'],
  ['Azizbek Rakhimov', 'student07', 'IT and IT Technologies'],
  ['Diyorbek Usmonov', 'student08', 'IT and IT Technologies'],
  ['Islombek Qodirov', 'student09', 'IT and IT Technologies'],
  ['Sardor Mirzayev', 'student10', 'IT and IT Technologies'],
  ['Muhammadali Yoqubov', 'student11', 'Computer Basics'],
  ['Akmaljon Ismoilov', 'student12', 'Computer Basics'],
  ['Shohruh Abduvaliyev', 'student13', 'Computer Basics'],
  ['Ibrohim Fayziyev', 'student14', 'Computer Basics'],
  ['Mirjalol Nurmatov', 'student15', 'Computer Basics'],
].map(([fullName, username, courseName], index) => {
  const [firstName, ...rest] = fullName.split(' ');
  return {
    fullName,
    firstName,
    lastName: rest.join(' '),
    username,
    password: STUDENT_PASSWORD,
    role: 'student',
    courseName,
    studentYear: index < 5 ? '9-sinf' : index < 10 ? '1-kurs' : '2026',
    paymentMethod: index % 2 === 0 ? 'cash' : 'card',
    contactOwner: index % 3 === 0 ? 'ota' : index % 3 === 1 ? 'ona' : "o'zi",
    contactOwnerFullName:
      index % 3 === 2
        ? fullName
        : `${rest.join(' ') || firstName} ${index % 3 === 0 ? 'Otasi' : 'Onasi'}`,
    contactOwnerRelation:
      index % 3 === 0 ? 'otasi' : index % 3 === 1 ? 'onasi' : "o'zi",
  };
});

const courses = [
  {
    name: 'Math Course',
    groupName: 'Math Group',
    price: 400000,
  },
  {
    name: 'IT and IT Technologies',
    groupName: 'IT Group',
    price: 500000,
  },
  {
    name: 'Computer Basics',
    groupName: 'Computer Group',
    price: 350000,
  },
];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function unwrapResponse(payload) {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
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

function sameIdSet(currentValues, expectedIds) {
  const current = new Set(ids(currentValues));
  return (
    current.size === expectedIds.length &&
    expectedIds.every((id) => current.has(id))
  );
}

function queryString(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = undefined;
  }

  async request(method, path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.accessToken
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : undefined;
    const data = unwrapResponse(payload);

    if (!response.ok) {
      const message =
        data?.message ?? payload?.error?.message ?? payload?.message ?? text;
      const error = new Error(
        `${method} ${path} failed (${response.status}): ${message}`,
      );
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return data;
  }

  get(path, params = {}) {
    return this.request('GET', `${path}${queryString(params)}`);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  patch(path, body) {
    return this.request('PATCH', path, body);
  }

  async login(username, password) {
    const data = await this.post('/auth/login', { username, password });
    this.accessToken = data.accessToken ?? data.token;
    if (!this.accessToken) {
      throw new Error('POST /auth/login did not return accessToken or token');
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

async function createOrReuseUser(api, user) {
  const existing = await findUserByUsername(api, user.username);
  if (existing) {
    return { record: existing, status: 'reused' };
  }

  const record = await api.post('/users', {
    username: user.username,
    password: user.password,
    role: user.role,
    status: 'active',
    firstName: user.firstName,
    lastName: user.lastName ?? '',
    studentYear: user.studentYear,
    paymentMethod: user.paymentMethod,
    contactOwner: user.contactOwner,
    contactOwnerFullName: user.contactOwnerFullName,
    contactOwnerRelation: user.contactOwnerRelation,
  });

  return { record, status: 'created' };
}

async function findByName(api, path, name, params = {}) {
  const records = await api.get(path, {
    search: name,
    limit: 100,
    ...params,
  });

  return (records ?? []).find((record) => record.name === name);
}

async function createOrReuseCourse(api, course, teacherId, studentIds) {
  const existing = await findByName(api, '/courses', course.name);
  const payload = {
    name: course.name,
    description: `QA demo course: ${course.name}`,
    price: course.price,
    teacherIds: [teacherId],
    students: studentIds,
  };

  if (!existing) {
    return { record: await api.post('/courses', payload), status: 'created' };
  }

  const existingTeacherIds = Array.isArray(existing.teacherIds)
    ? existing.teacherIds.map(toId)
    : existing.teacherId
      ? [toId(existing.teacherId)]
      : [];
  const needsUpdate =
    existing.price !== course.price ||
    existingTeacherIds.length !== 1 ||
    existingTeacherIds[0] !== teacherId ||
    !sameIdSet(existing.students, studentIds);

  if (!needsUpdate) {
    return { record: existing, status: 'reused' };
  }

  return {
    record: await api.patch(`/courses/${existing.id}`, payload),
    status: 'updated',
  };
}

async function createOrReuseGroup(
  api,
  course,
  courseRecord,
  teacherId,
  studentIds,
) {
  const existing = await findByName(api, '/groups', course.groupName);
  const payload = {
    name: course.groupName,
    course: courseRecord.id,
    teacher: teacherId,
    students: studentIds,
  };

  if (!existing) {
    return { record: await api.post('/groups', payload), status: 'created' };
  }

  const needsUpdate =
    toId(existing.course) !== courseRecord.id ||
    toId(existing.teacher) !== teacherId ||
    !sameIdSet(existing.students, studentIds);

  if (!needsUpdate) {
    return { record: existing, status: 'reused' };
  }

  return {
    record: await api.patch(`/groups/${existing.id}`, payload),
    status: 'updated',
  };
}

function printCredentials(assignments) {
  console.log('');
  console.log('====================================');
  console.log('DEMO USERS CREATED');
  console.log('====================================');
  console.log('');
  console.log('Teacher:');
  console.log(`${teacher.username} / ${teacher.password}`);
  console.log('');
  console.log('Students:');

  for (const assignment of assignments) {
    console.log(
      `${assignment.student.username} / ${assignment.student.password} / ${assignment.student.fullName} / ${assignment.course.name}`,
    );
  }
  console.log('');
}

function printSummary(title, entries) {
  console.log(title);
  for (const entry of entries) {
    console.log(`- ${entry.name}: ${entry.status}`);
  }
  console.log('');
}

async function main() {
  const baseUrl = normalizeBaseUrl(requiredEnv('DEMO_API_BASE_URL'));
  const adminUsername = requiredEnv('DEMO_ADMIN_USERNAME');
  const adminPassword = requiredEnv('DEMO_ADMIN_PASSWORD');
  const api = new ApiClient(baseUrl);

  await api.login(adminUsername, adminPassword);
  console.log(`Logged in via POST ${baseUrl}/auth/login as ${adminUsername}`);
  console.log('');

  const teacherResult = await createOrReuseUser(api, teacher);
  const studentResults = [];
  const courseResults = [];
  const groupResults = [];
  const assignments = [];

  for (const student of students) {
    const result = await createOrReuseUser(api, student);
    studentResults.push({
      student,
      record: result.record,
      status: result.status,
    });
  }

  for (const course of courses) {
    const courseStudents = studentResults.filter(
      (item) => item.student.courseName === course.name,
    );
    const studentIds = courseStudents.map((item) => item.record.id);
    const courseResult = await createOrReuseCourse(
      api,
      course,
      teacherResult.record.id,
      studentIds,
    );
    const groupResult = await createOrReuseGroup(
      api,
      course,
      courseResult.record,
      teacherResult.record.id,
      studentIds,
    );

    courseResults.push({ name: course.name, status: courseResult.status });
    groupResults.push({ name: course.groupName, status: groupResult.status });

    for (const item of courseStudents) {
      assignments.push({
        student: item.student,
        course,
        group: groupResult.record,
      });
    }
  }

  printSummary('Teacher:', [
    { name: teacher.username, status: teacherResult.status },
  ]);
  printSummary(
    'Students:',
    studentResults.map((item) => ({
      name: item.student.username,
      status: item.status,
    })),
  );
  printSummary('Courses:', courseResults);
  printSummary('Groups:', groupResults);
  printCredentials(assignments);
}

main().catch((error) => {
  console.error(`Real demo data creation failed: ${error.message}`);
  process.exitCode = 1;
});
