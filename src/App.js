import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Download, Printer, Lock, Unlock, Plus, Trash2 } from 'lucide-react';
import { db } from './firebaseConfig';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import './App.css';
import logo from './LeMarthelinois.png';
import './club_house.webp'; // Image de fond pour le header

const ScheduleManager = () => {
  const departments = [
    'Proposé à l\'accueil',
    'Proposé aux départs', 
    'Proposé au terrain',
    'Proposé aux carts'
  ];

  const timeSlots = [
    '--h--',
    'N/D',
    '06:00-12h30', '6h30-12h30', '7h00-12h30', '12h30-17h30', '12h30-18h00', '12h30-18h30', // Accueil
    '6h30-12h30', '7h00-12h30', '12h30-17h00', // Départs
    '8h00-12h30', '13h30-19h30', // Terrain
    '11h00-19h30', '13h00-16h00', '16h00-20h00' // Carts
  ];

  const departmentPresets = {
    "Proposé à l'accueil": ['06:00-12h30', '6h30-12h30', '7h00-12h30', '12h30-17h30', '12h30-18h00', '12h30-18h30'],
    "Proposé aux départs": ['6h30-12h30', '7h00-12h30', '12h30-17h00'],
    "Proposé au terrain": ['8h00-12h30', '13h30-19h30'],
    "Proposé aux carts": ['11h00-19h30', '13h00-16h00', '16h00-20h00']
  };

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
  const [copiedSchedule, setCopiedSchedule] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'week' ou 'month'
  const [weekDays, setWeekDays] = useState([]);
  const [monthViewDept, setMonthViewDept] = useState("Proposé à l'accueil"); // Département pour vue mensuelle

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Recalculer les jours quand la date ou le mode d'affichage change
    const days = getWeekDays(currentDate);
    setWeekDays(days);
  }, [currentDate, viewMode]);

  useEffect(() => {
    // Gérer les raccourcis clavier Ctrl+C / Ctrl+V / Delete (ou Cmd+C / Cmd+V sur Mac)
    const handleKeyDown = (e) => {
      if (!isAdmin) return;

      const isCopy = (e.ctrlKey || e.metaKey) && e.key === 'c';
      const isPaste = (e.ctrlKey || e.metaKey) && e.key === 'v';
      const isDelete = e.key === 'Delete' || e.key === 'Backspace';

      if (isCopy && selectedCell) {
        e.preventDefault();
        const sched = getSchedule(selectedCell.dept, selectedCell.emp, selectedCell.day);
        setCopiedSchedule(sched.schedule);
      }

      if (isPaste && selectedCell && copiedSchedule) {
        e.preventDefault();
        pasteSchedule(selectedCell.dept, selectedCell.emp, selectedCell.day);
      }

      if (isDelete && selectedCell) {
        e.preventDefault();
        deleteSchedule(selectedCell.dept, selectedCell.emp, selectedCell.day);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, selectedCell, copiedSchedule, schedules]);

  const getWeekDays = (date) => {
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - date.getDay());
    
    const days = [];
    const weeksToShow = viewMode === 'month' ? 4 : 1;
    
    for (let week = 0; week < weeksToShow; week++) {
      for (let i = 0; i < 7; i++) {
        const day = new Date(sunday);
        day.setDate(sunday.getDate() + (week * 7) + i);
        days.push(day);
      }
    }
    return days;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Charger les employés
      const employeesSnap = await getDocs(collection(db, 'employees'));
      const loadedEmployees = {};
      
      if (employeesSnap.empty) {
        // Données par défaut si la base est vide - initialiser Firebase
        loadedEmployees["Proposé à l'accueil"] = ['Jean Dupont', 'Marie Tremblay'];
        loadedEmployees["Proposé aux départs"] = ['Pierre Lavoie', 'Sophie Martin'];
        loadedEmployees["Proposé au terrain"] = ['Luc Gagnon', 'Anne Roy'];
        loadedEmployees["Proposé aux carts"] = ['Marc Côté', 'Julie Boucher'];
        
        // Sauvegarder les données par défaut dans Firebase
        for (const [dept, empList] of Object.entries(loadedEmployees)) {
          await setDoc(doc(db, 'employees', dept), { list: empList });
        }
      } else {
        employeesSnap.forEach(docSnap => {
          loadedEmployees[docSnap.id] = docSnap.data().list || [];
        });
      }
      setEmployees(loadedEmployees);

      // Charger les horaires
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
      alert('Erreur de connexion à Firebase. Vérifiez votre configuration dans firebaseConfig.js');
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

  const formatDate = (date) => `${date.getDate()} ${monthNames[date.getMonth()]}`;

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

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setSelectedCell(null);
    setCopiedSchedule(null);
  };

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

  const updateSchedule = async (dept, employee, day, value) => {
    // Formater automatiquement la saisie
    let formattedValue = value;
    
    // Si ce n'est pas --h-- ou N/D, on formate
    if (value !== '--h--' && value !== 'N/D' && value.trim() !== '') {
      // Enlever tous les caractères non numériques
      const numberOnly = value.replace(/[^0-9]/g, '');
      
      if (numberOnly.length >= 6) {
        // Ex: 8301730 ou 08301730
        let start, end;
        
        if (numberOnly.length === 8) {
          // Format complet: 08301730
          start = numberOnly.substring(0, 4);
          end = numberOnly.substring(4, 8);
        } else if (numberOnly.length === 7) {
          // Format: 8301730
          start = numberOnly.substring(0, 3);
          end = numberOnly.substring(3, 7);
        } else {
          // 6 chiffres: 830730
          start = numberOnly.substring(0, 3);
          end = numberOnly.substring(3, 6);
        }
        
        // Formater start
        const startHour = start.length === 4 ? start.substring(0, 2) : start.substring(0, 1);
        const startMin = start.length === 4 ? start.substring(2, 4) : start.substring(1, 3);
        
        // Formater end
        const endHour = end.length === 4 ? end.substring(0, 2) : end.substring(0, 1);
        const endMin = end.length === 4 ? end.substring(2, 4) : (end.length === 3 ? end.substring(1, 3) : end.substring(0, 2));
        
        formattedValue = `${parseInt(startHour)}h${startMin}-${parseInt(endHour)}h${endMin}`;
      } else {
        formattedValue = value; // Garder tel quel si pas assez de chiffres
      }
    }
    
    const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;
    const newSchedules = { ...schedules, [key]: { schedule: formattedValue } };
    setSchedules(newSchedules);
    await saveSchedule(key, { schedule: formattedValue });
  };

  const pasteSchedule = async (dept, employee, day) => {
    if (copiedSchedule) {
      const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;
      const newSchedules = { ...schedules, [key]: { schedule: copiedSchedule } };
      setSchedules(newSchedules);
      await saveSchedule(key, { schedule: copiedSchedule });
    }
  };

  const deleteSchedule = async (dept, employee, day) => {
    const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;
    const newSchedules = { ...schedules, [key]: { schedule: '--h--' } };
    setSchedules(newSchedules);
    await saveSchedule(key, { schedule: '--h--' });
  };

  const handleCellClick = (dept, emp, day) => {
    setSelectedCell({ dept, emp, day });
  };

  const getSchedule = (dept, employee, day) => {
    const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;
    return schedules[key] || { schedule: '--h--' };
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
    // Créer une nouvelle fenêtre pour l'export PDF
    const printWindow = window.open('', '', 'width=1200,height=800');
    let html = `<html><head><title>Horaire - ${dept}</title><style>
      @page { size: landscape; margin: 1cm; }
      body { 
        font-family: Arial, sans-serif; 
        padding: 20px;
        margin: 0;
      }
      h1 { 
        text-align: center;
        margin-bottom: 10px;
      }
      h2 { 
        text-align: center;
        margin-top: 0;
        margin-bottom: 20px;
        color: #666;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-top: 20px; 
      }
      th, td { 
        border: 1px solid #ddd; 
        padding: 8px; 
        text-align: center; 
      }
      th { 
        background-color: #4B5563; 
        color: white; 
      }
      th:first-child,
      td:first-child {
        text-align: left;
      }
      @media print {
        @page { size: landscape; }
      }
    </style></head><body><h1>${dept}</h1><h2>Semaine du ${getWeekString()}</h2><table><tr><th>Employé</th>`;
    
    weekDays.forEach((day, idx) => {
      html += `<th>${dayNames[day.getDay()]}<br/>${formatDate(day)}</th>`;
    });
    html += '</tr>';
    
    (employees[dept] || []).forEach(emp => {
      html += `<tr><td><strong>${emp}</strong></td>`;
      weekDays.forEach(day => {
        const sched = getSchedule(dept, emp, day);
        html += `<td>${sched.schedule}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</table></body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Attendre que la page soit chargée puis lancer l'impression (qui permet de sauvegarder en PDF)
    printWindow.onload = function() {
      printWindow.print();
    };
  };

  const printSchedule = (dept) => {
    const printWindow = window.open('', '', 'width=1200,height=800');
    let html = `<html><head><title>Horaire - ${dept}</title><style>
      @page { size: landscape; }
      body { 
        font-family: Arial, sans-serif; 
        padding: 20px;
        margin: 0;
      }
      h1 { 
        text-align: center;
        margin-bottom: 10px;
      }
      h2 { 
        text-align: center;
        margin-top: 0;
        margin-bottom: 20px;
        color: #666;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-top: 20px; 
      }
      th, td { 
        border: 1px solid #ddd; 
        padding: 8px; 
        text-align: center; 
      }
      th { 
        background-color: #4B5563; 
        color: white; 
      }
      th:first-child,
      td:first-child {
        text-align: left;
      }
      @media print {
        @page { size: landscape; }
      }
    </style></head><body><h1>${dept}</h1><h2>Semaine du ${getWeekString()}</h2><table><tr><th>Employé</th>`;
    
    weekDays.forEach((day, idx) => {
      html += `<th>${dayNames[day.getDay()]}<br/>${formatDate(day)}</th>`;
    });
    html += '</tr>';
    (employees[dept] || []).forEach(emp => {
      html += `<tr><td><strong>${emp}</strong></td>`;
      weekDays.forEach(day => {
        const sched = getSchedule(dept, emp, day);
        html += `<td>${sched.schedule}</td>`;
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

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(1 - firstDay.getDay()); // Commencer au dimanche précédent
    
    const days = [];
    for (let i = 0; i < 42; i++) { // 6 semaines max
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const changeMonth = (increment) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + increment);
    setCurrentDate(newDate);
  };

  // Vérifier si un employé a au moins un horaire défini (pas --h--) dans le mois
  const hasScheduleInMonth = (dept, emp, monthDays) => {
    return monthDays.some(day => {
      const sched = getSchedule(dept, emp, day);
      return sched.schedule && sched.schedule !== '--h--';
    });
  };

  const exportMonthSchedule = (dept) => {
    const monthDays = getMonthDays();
    const printWindow = window.open('', '', 'width=1400,height=900');
    
    let html = `<html><head><title>Horaire Mensuel - ${dept}</title><style>
      @page { size: landscape; margin: 1cm; }
      body { 
        font-family: Arial, sans-serif; 
        padding: 20px;
        margin: 0;
      }
      h1 { 
        text-align: center;
        margin-bottom: 10px;
        font-size: 24px;
      }
      h2 { 
        text-align: center;
        margin-top: 0;
        margin-bottom: 20px;
        color: #666;
        font-size: 18px;
      }
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
        margin-top: 20px;
      }
      .day-header {
        background: #374151;
        color: white;
        padding: 8px;
        text-align: center;
        font-weight: bold;
        border-radius: 4px;
      }
      .day-cell {
        border: 2px solid #e5e7eb;
        border-radius: 4px;
        padding: 8px;
        min-height: 100px;
        background: white;
      }
      .day-cell.other-month {
        opacity: 0.4;
        background: #f9fafb;
      }
      .day-cell.today {
        border-color: #3b82f6;
        border-width: 3px;
        background: #eff6ff;
      }
      .day-number {
        font-weight: bold;
        font-size: 16px;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid #e5e7eb;
      }
      .schedule-item {
        font-size: 11px;
        padding: 3px 5px;
        margin: 2px 0;
        background: #dbeafe;
        border-radius: 3px;
        display: flex;
        justify-content: space-between;
      }
      .emp-name {
        font-weight: 600;
        color: #1e40af;
      }
      .schedule-time {
        color: #1e3a8a;
      }
      .schedule-item.nd-schedule {
        background: #fee2e2;
        border-left: 3px solid #dc2626;
      }
      .schedule-item.nd-schedule .emp-name {
        color: #991b1b;
      }
      .schedule-item.nd-schedule .schedule-time {
        color: #dc2626;
        font-weight: 600;
      }
      @media print {
        @page { size: landscape; }
      }
    </style></head><body>
      <h1>${dept}</h1>
      <h2>${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}</h2>
      <div class="calendar-grid">`;
    
    // En-têtes des jours
    dayNames.forEach(day => {
      html += `<div class="day-header">${day}</div>`;
    });
    
    // Cellules des jours
    const employeesWithSchedules = (employees[dept] || []).filter(emp => 
      hasScheduleInMonth(dept, emp, monthDays)
    );
    
    monthDays.forEach((day) => {
      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
      const isToday = day.toDateString() === new Date().toDateString();
      
      html += `<div class="day-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}">`;
      html += `<div class="day-number">${day.getDate()}</div>`;
      
      // Ajouter les horaires des employés
      employeesWithSchedules.forEach(emp => {
        const sched = getSchedule(dept, emp, day);
        if (sched.schedule && sched.schedule !== '--h--') {
          const isND = sched.schedule === 'N/D';
          html += `<div class="schedule-item ${isND ? 'nd-schedule' : ''}">
            <span class="emp-name">${emp.split(' ')[0]}</span>
            <span class="schedule-time">${sched.schedule}</span>
          </div>`;
        }
      });
      
      html += '</div>';
    });
    
    html += '</div></body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = function() {
      printWindow.print();
    };
  };

  const printMonthSchedule = (dept) => {
    exportMonthSchedule(dept);
  };

  if (loading) {
    return (
      <div style={{minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontSize: '24px', fontWeight: 'bold', color: '#374151'}}>Chargement des horaires...</div>
      </div>
    );
  }

  // Vue mensuelle (calendrier)
  if (viewMode === 'month') {
    const monthDays = getMonthDays();
    
    // Filtrer les employés UNE SEULE FOIS pour tout le mois
    const employeesWithSchedules = (employees[monthViewDept] || []).filter(emp => 
      hasScheduleInMonth(monthViewDept, emp, monthDays)
    );
    
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="header-card">
            <div className="header-title-section">
              <img src={logo} alt="Le Marthelinois" className="logo" />
              <h1>Gestionnaire des horaires - Golf Le Marthelinois</h1>
              <div className="admin-controls">
                <button 
                  onClick={() => setViewMode('week')} 
                  className="view-mode-btn"
                >
                  📆 Affichage hebdomadaire
                </button>
                <div className="export-container">
                  <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn-export">
                    <Download size={20} /> Exporter / Imprimer
                  </button>
                  {showExportMenu && (
                    <div className="export-menu">
                      <div className="export-dept">
                        <div className="export-dept-title">{monthViewDept}</div>
                        <div className="export-actions">
                          <button onClick={() => { exportMonthSchedule(monthViewDept); setShowExportMenu(false); }} className="export-action-btn">
                            <Download size={16} /> Exporter
                          </button>
                          <button onClick={() => { printMonthSchedule(monthViewDept); setShowExportMenu(false); }} className="export-action-btn">
                            <Printer size={16} /> Imprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => isAdmin ? handleAdminLogout() : setShowPasswordModal(true)} className={`admin-btn ${isAdmin ? 'admin-logout' : 'admin-login'}`}>
                  {isAdmin ? <><Unlock size={20} /> Déconnexion Admin</> : <><Lock size={20} /> Mode Admin</>}
                </button>
              </div>
            </div>

            <div className="nav-section">
              <h2 className="week-title">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
              <div className="nav-buttons">
                <button onClick={() => changeMonth(-1)} className="nav-btn"><ChevronLeft size={20} /> Mois précédent</button>
                <button onClick={goToToday} className="btn-today">Aujourd'hui</button>
                <button onClick={() => changeMonth(1)} className="nav-btn">Mois suivant <ChevronRight size={20} /></button>
              </div>
            </div>

            <div className="dept-filter">
              <span className="filter-label">Département:</span>
              {departments.map(dept => (
                <button 
                  key={dept} 
                  onClick={() => setMonthViewDept(dept)} 
                  className={`filter-btn ${monthViewDept === dept ? 'active' : ''}`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          <div className="month-calendar-view">
            <div className="month-calendar-header">
              {dayNames.map(day => (
                <div key={day} className="month-calendar-day-name">{day}</div>
              ))}
            </div>
            <div className="month-calendar-grid">
              {monthDays.map((day, idx) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = day.toDateString() === new Date().toDateString();
                
                return (
                  <div 
                    key={idx} 
                    className={`month-calendar-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today-cell' : ''}`}
                  >
                    <div className="month-calendar-date">{day.getDate()}</div>
                    <div className="month-calendar-schedules">
                      {employeesWithSchedules.map((emp, empIdx) => {
                        const sched = getSchedule(monthViewDept, emp, day);
                        // N'afficher que si l'employé a un horaire défini (pas --h--)
                        if (sched.schedule && sched.schedule !== '--h--') {
                          const isND = sched.schedule === 'N/D';
                          return (
                            <div key={empIdx} className={`month-schedule-item ${isND ? 'nd-schedule' : ''}`}>
                              <span className="emp-name-short">{emp.split(' ')[0]}</span>
                              <span className="schedule-time">{sched.schedule}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
      </div>
    );
  }

  // Vue hebdomadaire (tableau)
  return (
    <div className="app-container">
      <div className="main-content">
        <div className="header-card">
          <div className="header-title-section">
            <img src={logo} alt="Le Marthelinois" className="logo" />
            <h1>Gestionnaire des horaires - Golf Le Marthelinois</h1>
            {copiedSchedule && isAdmin && (
              <div className="copied-indicator">
                📋 Horaire copié : {copiedSchedule}
                <button onClick={() => setCopiedSchedule(null)} className="clear-copy-btn">✕</button>
              </div>
            )}
            <div className="admin-controls">
              <button 
                onClick={() => setViewMode(viewMode === 'week' ? 'month' : 'week')} 
                className="view-mode-btn"
              >
                {viewMode === 'week' ? '📅 Affichage mensuel' : '📆 Affichage hebdomadaire'}
              </button>
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
              <button onClick={() => isAdmin ? handleAdminLogout() : setShowPasswordModal(true)} className={`admin-btn ${isAdmin ? 'admin-logout' : 'admin-login'}`}>
                {isAdmin ? <><Unlock size={20} /> Déconnexion Admin</> : <><Lock size={20} /> Mode Admin</>}
              </button>
            </div>
          </div>

          <div className="nav-section">
            <h2 className="week-title">Semaine du {getWeekString()}</h2>
            <div className="nav-buttons">
              <button onClick={goToPreviousWeek} className="nav-btn"><ChevronLeft size={20} /> Précédente</button>
              <button onClick={goToToday} className="btn-today">Aujourd'hui</button>
              <button onClick={goToNextWeek} className="nav-btn">Suivante <ChevronRight size={20} /></button>
              <button onClick={() => setShowCalendar(!showCalendar)} className="btn-calendar"><Calendar size={24} /></button>
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
                        {dayNames[day.getDay()]}<br/>
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
                        const isSelected = selectedCell && 
                          selectedCell.dept === dept && 
                          selectedCell.emp === emp && 
                          selectedCell.day.toISOString() === day.toISOString();
                        
                        return (
                          <td 
                            key={dayIdx} 
                            className={`schedule-cell ${isAdmin && isSelected ? 'selected-cell' : ''}`}
                            onClick={() => {
                              if (isAdmin) {
                                setSelectedCell({ dept, emp, day });
                              }
                            }}
                          >
                            {isAdmin ? (
                              <div className="schedule-input-container">
                                {selectedCell && selectedCell.dept === dept && selectedCell.emp === emp && selectedCell.day.toISOString() === day.toISOString() ? (
                                  // Mode édition complète : input text
                                  <input 
                                    type="text"
                                    value={sched.schedule}
                                    onChange={(e) => {
                                      const key = `${dept}-${emp}-${day.toISOString().split('T')[0]}`;
                                      const newSchedules = { ...schedules, [key]: { schedule: e.target.value } };
                                      setSchedules(newSchedules);
                                    }}
                                    onBlur={(e) => {
                                      updateSchedule(dept, emp, day, e.target.value);
                                      setSelectedCell(null); // Retour au mode select
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setSelectedCell(null); // Annuler
                                      } else if (e.key === 'Enter') {
                                        e.target.blur(); // Valider
                                      }
                                    }}
                                    autoFocus
                                    className="schedule-input"
                                    placeholder="ex: 830 1730"
                                  />
                                ) : (
                                  // Mode normal : select dropdown
                                  <select
                                    value={sched.schedule === '✏️ Saisie manuelle...' ? '--h--' : sched.schedule}
                                    onChange={(e) => {
                                      if (e.target.value === 'custom') {
                                        // Passer en mode édition
                                        setSelectedCell({ dept, emp, day });
                                      } else {
                                        updateSchedule(dept, emp, day, e.target.value);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()} // Empêcher la propagation du clic
                                    className="schedule-input schedule-select"
                                  >
                                    <option value="--h--">--h--</option>
                                    <option value="N/D">N/D</option>
                                    {(departmentPresets[dept] || []).map((preset, idx) => (
                                      <option key={`${preset}-${idx}`} value={preset}>{preset}</option>
                                    ))}
                                    <option value="custom">✏️ Saisie manuelle...</option>
                                  </select>
                                )}
                              </div>
                            ) : (
                              <div className="time-display">{sched.schedule}</div>
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