import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Printer, Lock, Unlock, Plus, Trash2, ChevronRight as ChevronRightIcon } from 'lucide-react';
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

  const departmentPresets = {
    "Proposé à l'accueil": ['6h00-12h30', '6h30-12h30', '7h00-12h30', '12h30-17h30', '12h30-18h00', '12h30-18h30'],
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
  const schedulesRef = useRef(schedules);
  const dropdownRef = useRef(null);
  const passwordInputRef = useRef(null);

  // Synchroniser le ref à chaque changement de schedules
  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  // focus password when modal opens
  useEffect(() => {
    if (showPasswordModal) {
      const t = setTimeout(() => {
        if (passwordInputRef.current) {
          try {
            passwordInputRef.current.focus();
            passwordInputRef.current.select && passwordInputRef.current.select();
          } catch (e) {}
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [showPasswordModal]);

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedExportDept, setSelectedExportDept] = useState('');
  const [visibleDepartment, setVisibleDepartment] = useState('Tous');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedSchedule, setCopiedSchedule] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null); // Pour les raccourcis clavier copier/coller
  const [editingCell, setEditingCell] = useState(null); // Pour l'édition au double-clic
  const [editingValue, setEditingValue] = useState(''); // Valeur temporaire pendant l'édition
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false); // Confirmation visuelle
  const [viewMode, setViewMode] = useState('week'); // 'week' ou 'month'
  const [weekDays, setWeekDays] = useState([]);
  const [monthViewDept, setMonthViewDept] = useState("Proposé à l'accueil"); // Département pour vue mensuelle
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [, forceUpdate] = useState(0);

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const days = getWeekDays(currentDate);
    setWeekDays(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, viewMode]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);


  useEffect(() => {
    // Gérer les raccourcis clavier Ctrl+C / Ctrl+V / Delete (ou Cmd+C / Cmd+V sur Mac)
    const handleKeyDown = (e) => {
      if (!isAdmin) return;
      if (editingCell) return;

      const isCopy = (e.ctrlKey || e.metaKey) && e.key === 'c';
      const isPaste = (e.ctrlKey || e.metaKey) && e.key === 'v';
      const isDelete = e.key === 'Delete' || e.key === 'Backspace';

      if (isCopy && selectedCell) {
        e.preventDefault();
        const sched = getSchedule(selectedCell.dept, selectedCell.emp, selectedCell.day);
        setCopiedSchedule(sched.schedule);
      }

      if (isPaste && selectedCell && copiedSchedule !== null) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedCell, copiedSchedule, schedules, editingCell]);

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

      const employeesSnap = await getDocs(collection(db, 'employees'));
      const loadedEmployees = {};

      if (employeesSnap.empty) {
        loadedEmployees["Proposé à l'accueil"] = ['Jean Dupont', 'Marie Tremblay'];
        loadedEmployees["Proposé aux départs"] = ['Pierre Lavoie', 'Sophie Martin'];
        loadedEmployees["Proposé au terrain"] = ['Luc Gagnon', 'Anne Roy'];
        loadedEmployees["Proposé aux carts"] = ['Marc Côté', 'Julie Boucher'];

        for (const [dept, empList] of Object.entries(loadedEmployees)) {
          await setDoc(doc(db, 'employees', dept), { list: empList });
        }
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

  const handleAdminLogin = async () => {
    if (password === '1000') {
      setIsAdmin(true);
      setShowPasswordModal(false);
      setPassword('');
      await loadData();
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
    let formattedValue = value;

    if (value !== '' && value !== 'N/D' && value.trim() !== '') {
      const sanitizedValue = value.replace(/h/g, '').replace(/\s+/g, '').replace(/-/g, '').trim();
      const numberOnly = sanitizedValue.replace(/[^0-9]/g, '');

      if (numberOnly.length >= 6) {
        let start, end;

        if (numberOnly.length === 8) {
          start = numberOnly.substring(0, 4);
          end = numberOnly.substring(4, 8);
        } else if (numberOnly.length === 7) {
          start = numberOnly.substring(0, 3);
          end = numberOnly.substring(3, 7);
        } else if (numberOnly.length === 6) {
          start = numberOnly.substring(0, 3);
          end = numberOnly.substring(3, 6);
        } else {
          start = numberOnly.substring(0, Math.ceil(numberOnly.length / 2));
          end = numberOnly.substring(Math.ceil(numberOnly.length / 2));
        }

        if (start && end) {
          const startHour = start.length === 4 ? start.substring(0, 2) : start.substring(0, 1);
          const startMin = start.length === 4 ? start.substring(2, 4) : start.substring(1, 3);

          let endHour = end.length === 4 ? end.substring(0, 2) : end.substring(0, 1);
          let endMin = end.length === 4 ? end.substring(2, 4) : (end.length === 3 ? end.substring(1, 3) : end.substring(0, 2));

          const parsedStartHour = parseInt(startHour);
          const parsedEndHour = parseInt(endHour);

          formattedValue = `${parsedStartHour}h${startMin}-${parsedEndHour}h${endMin}`;
        } else {
          formattedValue = value;
        }
      } else {
        formattedValue = value;
      }
    } else if (value.trim() === '') {
      formattedValue = ''; // Chaîne vide pour les quarts non définis
    }

    const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;

    const newSchedules = { ...schedules, [key]: { schedule: formattedValue } };
    setSchedules(newSchedules);

    await saveSchedule(key, { schedule: formattedValue });

    setShowSaveConfirmation(true);
    setTimeout(() => setShowSaveConfirmation(false), 2000);
  };

  const pasteSchedule = async (dept, employee, day) => {
    if (copiedSchedule !== null) {
      const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;
      const newSchedules = { ...schedules, [key]: { schedule: copiedSchedule } };
      setSchedules(newSchedules);
      await saveSchedule(key, { schedule: copiedSchedule });

      setShowSaveConfirmation(true);
      setTimeout(() => setShowSaveConfirmation(false), 2000);
    }
  };

  const deleteSchedule = async (dept, employee, day) => {
    const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;
    const newSchedules = { ...schedules, [key]: { schedule: '' } };
    setSchedules(newSchedules);
    await saveSchedule(key, { schedule: '' });

    setShowSaveConfirmation(true);
    setTimeout(() => setShowSaveConfirmation(false), 2000);
  };

  const getSchedule = (dept, employee, day) => {
    const key = `${dept}-${employee}-${day.toISOString().split('T')[0]}`;
    return schedules[key] || { schedule: '' };
  };

  const getScheduleColorClass = (schedule) => {
    if (typeof schedule !== 'string' || !schedule) {
      return '';
    }

    if (schedule === '') return '';
    if (schedule === 'N/D') return 'schedule-nd';

    const match = schedule.match(/^(\d+)h/);
    if (!match) return '';

    const startHour = parseInt(match[1]);

    if (startHour < 12) return 'schedule-morning';
    if (startHour >= 12 && startHour < 18) return 'schedule-afternoon';
    return 'schedule-evening';
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

          const currentSchedule = schedules[currentKey] || { schedule: '' };
          newSchedules[nextKey] = { ...currentSchedule };
        });
      });
    });

    setSchedules(newSchedules);
    await saveAllSchedules(newSchedules);
    setShowCopyConfirm(true);
  };

  // --- Impression : clone de la portion calendrier uniquement, en conservant le template visuel ---

  const removeInteractiveElementsFrom = (container) => {
    if (!container) return;
    const selectorsToRemove = [
      '.export-buttons-direct',
      '.icon-admin-btn',
      '.view-mode-btn',
      '.btn-copy',
      '.btn-add-emp',
      '.filter-btn',
      '.btn-delete',
      '.schedule-input',
      '.schedule-select',
      '.btn-edit-cell',
      '.export-print-btn',
      '.modal-overlay',
      '.modal',
      '.admin-controls',
      '.nav-buttons'
    ];
    selectorsToRemove.forEach(sel => {
      container.querySelectorAll(sel).forEach(n => n.parentNode && n.parentNode.removeChild(n));
    });

    // remplacer inputs/selects par leur valeur textuelle pour un rendu statique propre
    container.querySelectorAll('select').forEach(s => {
      const span = document.createElement('span');
      span.innerText = s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : '';
      span.className = 'print-replaced-select';
      s.parentNode && s.parentNode.replaceChild(span, s);
    });
    container.querySelectorAll('input').forEach(i => {
      const span = document.createElement('span');
      span.innerText = i.value || '';
      span.className = 'print-replaced-input';
      i.parentNode && i.parentNode.replaceChild(span, i);
    });
    // Remove buttons inside clone (icons)
    container.querySelectorAll('button').forEach(b => {
      // keep plain semantic buttons converted to text when appropriate; otherwise remove
      b.parentNode && b.parentNode.removeChild(b);
    });
  };

  // crée un clone contenant l'en-tête (header-card) + la dept-card ciblée
  const createPrintCloneForDeptWeek = (dept) => {
    const header = document.querySelector('.header-card');
    const deptCards = Array.from(document.querySelectorAll('.dept-card'));
    const deptCard = deptCards.find(c => c.querySelector('h3') && c.querySelector('h3').innerText.trim() === dept);
    if (!deptCard) return null;

    const clone = document.createElement('div');
    clone.className = 'print-clone';

    // cloner header et dept-card (pour garder le même template graphique)
    const headerClone = header ? header.cloneNode(true) : null;
    const deptClone = deptCard.cloneNode(true);

    // Nettoyer éléments interactifs des clones
    removeInteractiveElementsFrom(headerClone);
    removeInteractiveElementsFrom(deptClone);

    // For week view we want to ensure the table is fully expanded (remove overflow from container)
    if (deptClone.querySelector('.table-container')) {
      deptClone.querySelector('.table-container').style.overflow = 'visible';
    }

    // Insérer un petit indicateur (titre/sub) si nécessaire (conservatif: headerClone contient logo/titre)
    clone.appendChild(headerClone || document.createElement('div'));
    clone.appendChild(deptClone);

    document.body.appendChild(clone);
    // Force a reflow to ensure styles apply before printing
    // eslint-disable-next-line no-unused-expressions
    clone.offsetHeight;
    return clone;
  };

  // crée un clone contenant l'en-tête (header-card) + la vue mensuelle (month-calendar-view)
  const createPrintCloneForMonth = (dept) => {
    const header = document.querySelector('.header-card');
    const monthView = document.querySelector('.month-calendar-view');
    if (!monthView) return null;

    const clone = document.createElement('div');
    clone.className = 'print-clone';

    const headerClone = header ? header.cloneNode(true) : null;
    const monthClone = monthView.cloneNode(true);

    // Nettoyer éléments interactifs et ne garder que la grille + contenu
    removeInteractiveElementsFrom(headerClone);
    removeInteractiveElementsFrom(monthClone);

    clone.appendChild(headerClone || document.createElement('div'));
    clone.appendChild(monthClone);

    document.body.appendChild(clone);
    // Force reflow
    // eslint-disable-next-line no-unused-expressions
    clone.offsetHeight;
    return clone;
  };

  const cleanupPrintClone = (clone, afterprintHandler, fallbackTimer) => {
    try {
      if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
      if (afterprintHandler) window.removeEventListener('afterprint', afterprintHandler);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    } catch (err) {
      console.error('cleanupPrintClone error', err);
    }
  };

  // Impression de la vue hebdomadaire — n'imprime que la portion calendrier du département choisi en conservant le template visuel
  const printSchedule = (dept) => {
    try {
      const clone = createPrintCloneForDeptWeek(dept);
      if (!clone) {
        alert('Impossible de trouver le département à imprimer.');
        return;
      }

      const afterprintHandler = () => {
        cleanupPrintClone(clone, afterprintHandler, fallbackTimeout);
      };
      window.addEventListener('afterprint', afterprintHandler);

      // Small timeout to ensure browser has rendered clone and computed styles
      setTimeout(() => {
        window.print();
      }, 200);

      const fallbackTimeout = setTimeout(() => {
        cleanupPrintClone(clone, afterprintHandler, fallbackTimeout);
      }, 5000);
    } catch (err) {
      console.error('Erreur printSchedule:', err);
    }
  };

  // Impression de la vue mensuelle — n'imprime que la portion calendrier (grille) en conservant le template visuel
  const printMonthSchedule = (dept) => {
    try {
      const clone = createPrintCloneForMonth(dept);
      if (!clone) {
        alert('Impossible de préparer l\'impression du calendrier.');
        return;
      }

      const afterprintHandler = () => {
        cleanupPrintClone(clone, afterprintHandler, fallbackTimeout);
      };
      window.addEventListener('afterprint', afterprintHandler);

      setTimeout(() => {
        window.print();
      }, 200);

      const fallbackTimeout = setTimeout(() => {
        cleanupPrintClone(clone, afterprintHandler, fallbackTimeout);
      }, 5000);
    } catch (err) {
      console.error('Erreur printMonthSchedule:', err);
    }
  };

  // --- Fin impression ---

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
    const startDate = new Date(firstDay);
    startDate.setDate(1 - firstDay.getDay());

    const days = [];
    let weeksToShow = 0;

    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);

      if (day.getMonth() === month) {
        weeksToShow = Math.floor(i / 7) + 1;
      }
    }

    for (let i = 0; i < weeksToShow * 7; i++) {
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

  const hasScheduleInMonth = (dept, emp, monthDays) => {
    return monthDays.some(day => {
      const sched = getSchedule(dept, emp, day);
      return sched.schedule && sched.schedule !== '';
    });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#374151' }}>Chargement des horaires...</div>
      </div>
    );
  }

  // Vue mensuelle (calendrier)
  if (viewMode === 'month') {
    const monthDays = getMonthDays();

    const employeesWithSchedules = (employees[monthViewDept] || []).filter(emp =>
      hasScheduleInMonth(monthViewDept, emp, monthDays)
    );

    return (
      <div className="app-container">
        <div className="main-content">
          <div className="header-card sticky-header">
            <div className="header-title-section">
              <img src={logo} alt="Le Marthelinois" className="logo" />
              <h1>Gestionnaire des horaires</h1>
              <div className="admin-controls">

                {/* Menu d'Exportation en boutons directs pour impression */}
                <div className="export-buttons-direct">
                  <span className="export-label">Imprimer le calendrier:</span>
                  <select
                    value={selectedExportDept}
                    onChange={(e) => setSelectedExportDept(e.target.value)}
                    className="dropdown-select"
                    style={{ width: '180px' }}
                  >
                    <option value="">Choisir un département</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (selectedExportDept) {
                        printMonthSchedule(selectedExportDept);
                      }
                    }}
                    className="export-print-btn"
                    disabled={!selectedExportDept}
                    title="Imprimer le département sélectionné en vue mensuelle"
                  >
                    <Printer size={20} />
                  </button>
                </div>

                {/* Bouton Admin/Déconnexion discret */}
                <button
                  onClick={() => isAdmin ? handleAdminLogout() : setShowPasswordModal(true)}
                  className="icon-admin-btn"
                  title={isAdmin ? 'Déconnexion Admin' : 'Mode Admin'}
                >
                  {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
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

            <button
              onClick={() => setViewMode('week')}
              className="view-mode-btn view-mode-btn-absolute"
            >
              📆 Hebdomadaire
            </button>
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
                        if (sched.schedule && sched.schedule !== '') {
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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                placeholder="Mot de passe"
                className="modal-input"
                ref={passwordInputRef}
              />
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
        <div className="header-card sticky-header">
          <div className="header-title-section">
            <img src={logo} alt="Le Marthelinois" className="logo" />
            <h1>Gestionnaire des horaires</h1>
            {copiedSchedule && isAdmin && (
              <div className="copied-indicator">
                📋 Horaire copié : {copiedSchedule}
                <button onClick={() => setCopiedSchedule(null)} className="clear-copy-btn">✕</button>
              </div>
            )}
            {showSaveConfirmation && (
              <div className="save-confirmation">
                ✓ Sauvegardé
              </div>
            )}
            <div className="admin-controls">
              <div className="export-buttons-direct">
                <span className="export-label">Imprimer l'horaire:</span>
                <select
                  value={selectedExportDept}
                  onChange={(e) => setSelectedExportDept(e.target.value)}
                  className="dropdown-select"
                  style={{ width: '180px' }}
                >
                  <option value="">Choisir un département</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedExportDept) {
                      printSchedule(selectedExportDept);
                    }
                  }}
                  className="export-print-btn"
                  disabled={!selectedExportDept}
                  title="Imprimer le département sélectionné"
                >
                  <Printer size={20} />
                </button>
              </div>

              <button
                onClick={() => isAdmin ? handleAdminLogout() : setShowPasswordModal(true)}
                className="icon-admin-btn"
                title={isAdmin ? 'Déconnexion Admin' : 'Mode Admin'}
              >
                {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
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

          <button
            onClick={() => setViewMode('month')}
            className="view-mode-btn view-mode-btn-absolute"
          >
            📅 Mensuel
          </button>
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
                    <th className="sticky-col">Employé</th>
                    {weekDays.map((day, idx) => (
                      <th key={idx}>
                        {dayNames[day.getDay()]}<br />
                        <span className="date-small">{formatDate(day)}</span>
                      </th>
                    ))}
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(employees[dept] || []).map((emp, empIdx) => (
                    <tr key={`${dept}-${empIdx}`}>
                      <td className="emp-name sticky-col">{emp}</td>
                      {weekDays.map((day, dayIdx) => {
                        const sched = getSchedule(dept, emp, day);
                        const isSelected = selectedCell &&
                          selectedCell.dept === dept &&
                          selectedCell.emp === emp &&
                          selectedCell.day.toISOString() === day.toISOString();

                        return (
                          <td
                            key={`${dayIdx}-${sched.schedule}`}
                            className={`schedule-cell ${getScheduleColorClass(sched.schedule)} ${isAdmin && isSelected ? 'selected-cell' : ''}`}
                            onClick={() => {
                              if (isAdmin) {
                                setSelectedCell({ dept, emp, day });
                              }
                            }}
                          >
                            {isAdmin ? (
                              <div className="schedule-input-container">
                                {editingCell &&
                                  editingCell.dept === dept &&
                                  editingCell.emp === emp &&
                                  editingCell.day.toISOString() === day.toISOString() ? (
                                  <input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onBlur={() => {
                                      updateSchedule(dept, emp, day, editingValue);
                                      setEditingCell(null);
                                      setEditingValue('');
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateSchedule(dept, emp, day, editingValue);
                                        setEditingCell(null);
                                        setEditingValue('');
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                        setEditingValue('');
                                      }
                                    }}
                                    autoFocus
                                    className="schedule-input"
                                    placeholder="ex: 830 1730"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <select
                                      value={sched.schedule}
                                      onChange={(e) => {
                                        updateSchedule(dept, emp, day, e.target.value);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="schedule-input schedule-select"
                                      style={{ flex: 1 }}
                                    >
                                      <option value=""></option>
                                      <option value="N/D">N/D</option>
                                      {(departmentPresets[dept] || []).map((preset, idx) => (
                                        <option key={`${preset}-${idx}`} value={preset}>{preset}</option>
                                      ))}
                                      {sched.schedule !== '' &&
                                        sched.schedule !== 'N/D' &&
                                        !(departmentPresets[dept] || []).includes(sched.schedule) && (
                                          <option key="custom-current" value={sched.schedule}>
                                            {sched.schedule}
                                          </option>
                                        )}
                                    </select>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCell({ dept, emp, day });
                                        setEditingValue(sched.schedule === '' ? '' : sched.schedule);
                                      }}
                                      className="btn-edit-cell"
                                      title="Saisir un horaire personnalisé"
                                    >
                                      ✏️
                                    </button>
                                  </div>
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
                  <ChevronRightIcon size={20} /> Copier vers semaine suivante
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
              placeholder="Mot de passe"
              className="modal-input"
              ref={passwordInputRef}
            />
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
            <input
              type="text"
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addEmployee()}
              placeholder="Nom de l'employé"
              className="modal-input"
            />
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
                  <button
                    key={idx}
                    onClick={() => selectDateFromCalendar(day)}
                    className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                  >
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