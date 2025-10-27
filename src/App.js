// Copiez ce fichier dans src/App.js
import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Download, Printer, Lock, Unlock, Plus, Trash2 } from 'lucide-react';
import { db } from './firebaseConfig';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import './App.css';

const ScheduleManager = () => {
  const departments = [
    'Proposé à l\'accueil',
    'Proposé aux départs', 
    'Proposé au terrain',
    'Proposé aux carts'
  ];

  const timeSlots = [
    '------',
    'N/D',
    '00:00', '00:30', '01:00', '01:30', '02:00', '02:30',
    '03:00', '03:30', '04:00', '04:30', '05:00', '05:30',
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
    '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
  ];

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [employees, setEmployees] = useState({});
  const [schedules, setSchedules] = useState({});
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [visibleDepartment, setVisibleDepartment] = useState('Tous');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const employeesSnap = await getDocs(collection(db, 'employees'));
      const loadedEmployees = {};
      
      if (employeesSnap.empty) {
        loadedEmployees['Proposé à l\'accueil'] = ['Jean Dupont', 'Marie Tremblay'];
        loadedEmployees['Proposé aux départs'] = ['Pierre Lavoie', 'Sophie Martin'];
        loadedEmployees['Proposé au terrain'] = ['Luc Gagnon', 'Anne Roy'];
        loadedEmployees['Proposé aux carts'] = ['Marc Côté', 'Julie Boucher'];
      } else {
        employeesSnap.forEach(docSnap => {
          loadedEmployees[docSnap.id] = docSnap.data().list || [];
        });
      }
      setEmployees(loadedEmployees);

      const schedulesSnap = await getDocs(collection(db, 'schedules'));
      const loadedSchedules = {};
      schedulesSnap.forEach(docSnap => {
        loadedSchedules[docSnap.id] = docSnap.data();
      });
      setSchedules(loadedSchedules);
      setLoading(false);
    } catch (error) {
      console.error('Erreur de chargement:', error);
      setLoading(false);
      alert('Erreur lors du chargement des données.');
    }
  };

  const saveEmployees = async (newEmployees) => {
    try {
      for (const [dept, empList] of Object.entries(newEmployees)) {
        await setDoc(doc(db, 'employees', dept), { list: empList });
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const saveSchedule = async (key, scheduleData) => {
    try {
      await setDoc(doc(db, 'schedules', key), scheduleData);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const saveAllSchedules = async (newSchedules) => {
    try {
      for (const [key, schedule] of Object.entries(newSchedules)) {
        await setDoc(doc(db, 'schedules', key), schedule);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const getWeekDays = (date) => {
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - date.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getWeekDays(currentDate);
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  const formatDate = (date) => `${date.getDate()}/${date.getMonth() + 1}`;

  const getWeekString = () => {
    const sunday = weekDays[0];
    const saturday = weekDays[6];
    return `${formatDate(sunday)} - ${formatDate(saturday)}`;
  };

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleAdminLogin = () => {
    if (password === '1000') {
      setIsAdmin(true);
      setShowPasswordModal(false);
      setPassword('');
    } else {
      alert('Mot de passe incorrect');
    }
  };

  const handleAdminLogout = () => setIsAdmin(false);

  const addEmployee = async () => {
    if (newEmployeeName && selectedDepartment) {
      const newEmps = { ...employees };
      if (!newEmps[selectedDepartment]) newEmps[selectedDepartment] = [];
      newEmps[selectedDepartment] = [...newEmps[selectedDepartment], newEmployeeName];
      setEmployees(newEmps);
      await saveEmployees(newEmps);
      setNewEmployeeName('');
      setShowAddEmployee(false);
    }
  };

  const handleDeleteClick = (deptName, employeeName) => {
    setEmployeeToDelete({ dept: deptName, name: employeeName });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (employeeToDelete) {
      const newEmps = { ...employees };
      if (newEmps[employeeToDelete.dept]) {
        newEmps[employeeToDelete.dept] = newEmps[employeeToDelete.dept].filter(
          name => name !== employeeToDelete.name
        );
      }
      setEmployees(newEmps);
      await saveEmployees(newEmps);
      setShowDeleteConfirm(false);
      setEmployeeToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setEmployeeToDelete(null);
  };

  const updateSchedule = async (dept, employee, day, type, value) => {
    const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;
    const newSchedules = { ...schedules, [key]: { ...schedules[key], [type]: value } };
    setSchedules(newSchedules);
    await saveSchedule(key, newSchedules[key]);
  };

  const getSchedule = (dept, employee, day) => {
    const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;
    return schedules[key] || { start: '------', end: '------' };
  };

  const copyWeekToNext = async () => {
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(currentDate.getDate() + 7);
    const nextWeekDays = getWeekDays(nextWeekDate);
    const newSchedules = { ...schedules };
    
    departments.forEach(dept => {
      (employees[dept] || []).forEach(emp => {
        weekDays.forEach((currentDay, idx) => {
          const currentKey = `${dept}-${emp}-${currentDay.toISOString().split('T')[0]}`;
          const nextKey = `${dept}-${emp}-${nextWeekDays[idx].toISOString().split('T')[0]}`;
          if (schedules[currentKey]) {
            newSchedules[nextKey] = { ...schedules[currentKey] };
          }
        });
      });
    });
    
    setSchedules(newSchedules);
    await saveAllSchedules(newSchedules);
    setShowCopyConfirm(true);
  };

  const exportSchedule = (dept) => {
    let content = `Horaire - ${dept}\nSemaine du ${getWeekString()}\n\n`;
    weekDays.forEach((day, idx) => {
      content += `${dayNames[idx]} ${formatDate(day)}\n`;
      (employees[dept] || []).forEach(emp => {
        const sched = getSchedule(dept, emp, day);
        content += `${emp}: ${sched.start} - ${sched.end}\n`;
      });
      content += '\n';
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `horaire-${dept}-${getWeekString()}.txt`;
    a.click();
  };

  const printSchedule = (dept) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    let html = `<html><head><title>Horaire - ${dept}</title><style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { text-align: center; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #4B5563; color: white; }
    </style></head><body><h1>${dept}</h1><h2>Semaine du ${getWeekString()}</h2><table><tr><th>Employé</th>`;
    
    weekDays.forEach((day, idx) => {
      html += `<th>${dayNames[idx]}<br/>${formatDate(day)}</th>`;
    });
    html += '</tr>';
    (employees[dept] || []).forEach(emp => {
      html += `<tr><td><strong>${emp}</strong></td>`;
      weekDays.forEach(day => {
        const sched = getSchedule(dept, emp, day);
        html += `<td>${sched.start} - ${sched.end}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const selectDateFromCalendar = (date) => {
    setCurrentDate(date);
    setShowCalendar(false);
  };

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(1 - firstDay.getDay());
    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const changeCalendarMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  if (loading) {
    return (
      <div style={{minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontSize: '24px', fontWeight: 'bold', color: '#374151'}}>Chargement des horaires...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="header-card">
          <div className="header-title-section">
            <div className="title-with-logo">
              <img src="https://github.com/user-attachments/assets/eb89119c-7b4f-4b2e-81e4-e3d6e48308df" alt="Logo" className="logo" />
              <h1>Gestionnaire des horaires du Golf Le Marthelinois</h1>
            </div>
            <button onClick={() => isAdmin ? handleAdminLogout() : setShowPasswordModal(true)} className={`admin-btn ${isAdmin ? 'admin-logout' : 'admin-login'}`}>
              {isAdmin ? <><Unlock size={20} /> Déconnexion Admin</> : <><Lock size={20} /> Mode Admin</>}
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-buttons">
              <button onClick={goToPreviousWeek} className="nav-btn"><ChevronLeft size={20} /> Précédente</button>
              <button onClick={goToToday} className="btn-today">Aujourd'hui</button>
              <button onClick={goToNextWeek} className="nav-btn">Suivante <ChevronRight size={20} /></button>
              <button onClick={() => setShowCalendar(!showCalendar)} className="btn-calendar"><Calendar size={24} /></button>
            </div>
            <h2 className="week-title">Semaine du {getWeekString()}</h2>
            <div className="export-container">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn-export">
                <Download size={20} /> Exporter / Imprimer
              </button>
              {showExportMenu && (
                <div className="export-menu">
                  {departments.map(dept => (
                    <div key={dept} className="export-dept">
                      <div className="export-dept-title">{dept}</div>
                      <div className="export-actions">
                        <button onClick={() => { exportSchedule(dept); setShowExportMenu(false); }} className="export-action-btn">
                          <Download size={16} /> Exporter
                        </button>
                        <button onClick={() => { printSchedule(dept); setShowExportMenu(false); }} className="export-action-btn">
                          <Printer size={16} /> Imprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="dept-filter">
            <span className="filter-label">Afficher:</span>
            <button onClick={() => setVisibleDepartment('Tous')} className={`filter-btn ${visibleDepartment === 'Tous' ? 'active' : ''}`}>
              Tous les départements
            </button>
            {departments.map(dept => (
              <button key={dept} onClick={() => setVisibleDepartment(dept)} className={`filter-btn ${visibleDepartment === dept ? 'active' : ''}`}>
                {dept}
              </button>
            ))}
          </div>
        </div>

        {departments.filter(dept => visibleDepartment === 'Tous' || visibleDepartment === dept).map(dept => (
          <div key={dept} className="dept-card">
            <div className="dept-header">
              <h3>{dept}</h3>
              {isAdmin && (
                <button onClick={() => { setSelectedDepartment(dept); setShowAddEmployee(true); }} className="btn-add-emp">
                  <Plus size={20} /> Ajouter Employé
                </button>
              )}
            </div>
            <div className="table-container">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>Employé</th>
                    {weekDays.map((day, idx) => (
                      <th key={idx}>
                        {dayNames[idx]}<br/>
                        <span className="date-small">{formatDate(day)}</span>
                      </th>
                    ))}
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(employees[dept] || []).map((emp, empIdx) => (
                    <tr key={`${dept}-${empIdx}`}>
                      <td className="emp-name">{emp}</td>
                      {weekDays.map((day, dayIdx) => {
                        const sched = getSchedule(dept, emp, day);
                        return (
                          <td key={dayIdx} className="schedule-cell">
                            {isAdmin ? (
                              <div className="time-selects">
                                <select value={sched.start} onChange={(e) => updateSchedule(dept, emp, day, 'start', e.target.value)} className="time-select">
                                  {timeSlots.map(time => (<option key={time} value={time}>{time}</option>))}
                                </select>
                                <select value={sched.end} onChange={(e) => updateSchedule(dept, emp, day, 'end', e.target.value)} className="time-select">
                                  {timeSlots.map(time => (<option key={time} value={time}>{time}</option>))}
                                </select>
                              </div>
                            ) : (
                              <div className="time-display">{sched.start} - {sched.end}</div>
                            )}
                          </td>
                        );
                      })}
                      {isAdmin && (
                        <td>
                          <button onClick={() => handleDeleteClick(dept, emp)} className="btn-delete" title="Supprimer">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <div className="copy-section">
                <button onClick={copyWeekToNext} className="btn-copy">
                  <ChevronRight size={20} /> Copier vers semaine suivante
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Connexion Administrateur</h3>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()} placeholder="Mot de passe" className="modal-input" />
            <div className="modal-buttons">
              <button onClick={handleAdminLogin} className="modal-btn primary">Connexion</button>
              <button onClick={() => { setShowPasswordModal(false); setPassword(''); }} className="modal-btn secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {showAddEmployee && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Ajouter un Employé</h3>
            <p className="modal-subtitle">Département: {selectedDepartment}</p>
            <input type="text" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addEmployee()} placeholder="Nom de l'employé" className="modal-input" />
            <div className="modal-buttons">
              <button onClick={addEmployee} className="modal-btn primary">Ajouter</button>
              <button onClick={() => { setShowAddEmployee(false); setNewEmployeeName(''); }} className="modal-btn secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {showCalendar && (
        <div className="modal-overlay">
          <div className="modal calendar-modal">
            <div className="calendar-header">
              <button onClick={() => changeCalendarMonth(-1)} className="calendar-nav-btn"><ChevronLeft size={20} /></button>
              <h3>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
              <button onClick={() => changeCalendarMonth(1)} className="calendar-nav-btn"><ChevronRight size={20} /></button>
            </div>
            <div className="calendar-days-header">
              {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (<div key={day}>{day}</div>))}
            </div>
            <div className="calendar-days">
              {getCalendarDays().map((day, idx) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = day.toDateString() === new Date().toDateString();
                const isSelected = day.toDateString() === currentDate.toDateString();
                return (
                  <button key={idx} onClick={() => selectDateFromCalendar(day)} className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}>
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowCalendar(false)} className="modal-btn secondary">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && employeeToDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="delete-title">Confirmer la suppression</h3>
            <p>Voulez-vous vraiment supprimer <strong>{employeeToDelete.name}</strong> du département <strong>{employeeToDelete.dept}</strong> ?</p>
            <div className="modal-buttons">
              <button onClick={confirmDelete} className="modal-btn danger">Supprimer</button>
              <button onClick={cancelDelete} className="modal-btn secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {showCopyConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="success-title">✓ Copie réussie</h3>
            <p>Les horaires de la semaine du <strong>{getWeekString()}</strong> ont été copiés vers la semaine suivante avec succès !</p>
            <div className="modal-buttons">
              <button onClick={() => setShowCopyConfirm(false)} className="modal-btn success">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleManager;