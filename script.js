let students = [];
let attendanceData = {}; 
let currentDate = new Date().toISOString().split('T')[0];
let chart = null;

document.addEventListener('DOMContentLoaded', function() {
  loadStudents();
  document.getElementById('attendanceDate').value = currentDate;
  loadAttendanceForDate();
  document.getElementById('reportFrom').value = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
  document.getElementById('reportTo').value = currentDate;
});

function loadStudents() {
  const savedStudents = localStorage.getItem('students');
  if (savedStudents) {
    students = JSON.parse(savedStudents);
  } else {
    fetch('students.json')
      .then(response => response.json())
      .then(data => {
        students = data;
        localStorage.setItem('students', JSON.stringify(students));
        displayStudents();
      })
      .catch(() => {
        students = [];
        displayStudents();
      });
  }
  displayStudents();
}

function displayStudents() {
  const container = document.getElementById('studentList');
  if (students.length === 0) {
    container.innerHTML = '<p>No students found. Add some students first.</p>';
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Class</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${students.map(student => `
          <tr>
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>${student.class}</td>
            <td>
              <button onclick="editStudent('${student.id}')">Edit</button>
              <button class="danger" onclick="deleteStudent('${student.id}')">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

document.getElementById('studentForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const id = document.getElementById('studentId').value;
  const name = document.getElementById('studentName').value;
  const cls = document.getElementById('studentClass').value;

  const studentIndex = students.findIndex(s => s.id === id);
  const newStudent = { id, name, class: cls };

  if (studentIndex > -1) {
    students[studentIndex] = newStudent;
    showMessage('Student updated successfully!', 'success');
  } else {
    students.push(newStudent);
    showMessage('Student added successfully!', 'success');
  }

  localStorage.setItem('students', JSON.stringify(students));
  displayStudents();
  closeAddStudentModal();
  document.getElementById('studentForm').reset();
});

function loadAttendanceForDate() {
  currentDate = document.getElementById('attendanceDate').value;
  const savedAttendance = localStorage.getItem('attendanceData');
  if (savedAttendance) {
    attendanceData = JSON.parse(savedAttendance);
  }
  displayAttendanceForm();
}

function displayAttendanceForm() {
  const container = document.getElementById('attendanceForm');
  if (students.length === 0) {
    container.innerHTML = '<p>Add students first to mark attendance.</p>';
    return;
  }
  
  container.innerHTML = `
    <h3>Attendance for ${currentDate}</h3>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Class</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${students.map(student => {
          const status = attendanceData[currentDate]?.[student.id] || 'absent';
          return `
            <tr>
              <td>${student.id}</td>
              <td>${student.name}</td>
              <td>${student.class}</td>
              <td>
                <select onchange="updateAttendance('${student.id}', this.value)">
                  <option value="absent" ${status === 'absent' ? 'selected' : ''}>Absent</option>
                  <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
                </select>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function updateAttendance(studentId, status) {
  if (!attendanceData[currentDate]) {
    attendanceData[currentDate] = {};
  }
  attendanceData[currentDate][studentId] = status;
  localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
  showMessage('Attendance updated!', 'success');
}

function generateReport() {
  const fromDate = document.getElementById('reportFrom').value;
  const toDate = document.getElementById('reportTo').value;
  
  if (!fromDate || !toDate) {
    showMessage('Please select date range.', 'error');
    return;
  }

  const dateRange = getDatesBetween(fromDate, toDate);
  const presentCounts = {};
  const totalDays = dateRange.length;

  students.forEach(student => {
    let present = 0;
    dateRange.forEach(date => {
      if (attendanceData[date]?.[student.id] === 'present') {
        present++;
      }
    });
    presentCounts[student.id] = present;
  });

  const sortedStudents = students.map(s => ({
    ...s,
    attendance: Math.round((presentCounts[s.id] / totalDays) * 100)
  })).sort((a, b) => b.attendance - a.attendance);

  displayReportTable(sortedStudents, totalDays);
  createAttendanceChart(presentCounts, totalDays);
}

function getDatesBetween(start, end) {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function displayReportTable(studentsData, totalDays) {
  const container = document.getElementById('reportSection');
  const tableHtml = `
    <h3>Attendance Report (${totalDays} days)</h3>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Class</th>
          <th>Present Days</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${studentsData.map(student => `
          <tr>
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>${student.class}</td>
            <td>${student.presentDays || 0}</td>
            <td>${student.attendance}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = tableHtml + (document.getElementById('chartContainer') ? '' : '<div id="chartContainer"><canvas id="attendanceChart"></canvas></div>');
}

function createAttendanceChart(presentCounts, totalDays) {
  const ctx = document.getElementById('attendanceChart')?.getContext('2d');
  if (!ctx) return;

  const labels = students.map(s => s.name);
  const data = students.map(s => (presentCounts[s.id] / totalDays) * 100);

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Attendance %',
        data: data,
        backgroundColor: 'rgba(102, 126, 234, 0.6)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

function openAddStudentModal(editStudent = null) {
  const modal = document.getElementById('addStudentModal');
  if (editStudent) {
    const student = students.find(s => s.id === editStudent);
    if (student) {
      document.getElementById('studentId').value = student.id;
      document.getElementById('studentName').value = student.name;
      document.getElementById('studentClass').value = student.class;
    }
  }
  modal.style.display = 'block';
}

function closeAddStudentModal() {
  document.getElementById('addStudentModal').style.display = 'none';
  document.getElementById('studentForm').reset();
}

window.onclick = function(event) {
  const modal = document.getElementById('addStudentModal');
  if (event.target == modal) {
    closeAddStudentModal();
  }
}

function editStudent(id) {
  openAddStudentModal(id);
}

function deleteStudent(id) {
  if (confirm('Are you sure you want to delete this student?')) {
    students = students.filter(s => s.id !== id);
    localStorage.setItem('students', JSON.stringify(students));
    displayStudents();
    loadAttendanceForDate(); // Refresh attendance form
    showMessage('Student deleted successfully!', 'success');
  }
}

function showMessage(text, type) {
  const successMsg = document.getElementById('successMsg');
  const errorMsg = document.getElementById('errorMsg');
  
  if (type === 'success') {
    successMsg.textContent = text;
    successMsg.style.display = 'block';
    errorMsg.style.display = 'none';
    setTimeout(() => successMsg.style.display = 'none', 3000);
  } else {
    errorMsg.textContent = text;
    errorMsg.style.display = 'block';
    successMsg.style.display = 'none';
    setTimeout(() => errorMsg.style.display = 'none', 5000);
  }
}
