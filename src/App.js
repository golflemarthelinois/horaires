import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Printer, Lock, Unlock, Plus, Trash2, Clock, Save, MessageSquare } from 'lucide-react';
import { db } from './firebaseConfig';
import { collection, getDocs, setDoc, doc, addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import './App.css';
import logo from './LeMarthelinois.png';
import './club_house.webp';

const ScheduleManager = () => {
  const departments = [
    "Proposé à l'accueil",
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

  // ========== NOUVEAUX ÉTATS POUR LES FONCTIONNALITÉS ==========
  
  // Jours fériés du Québec 2025
  const [holidays] = useState([
    { date: '2025-01-01', name: 'Jour de l\'An' },
    { date: '2025-04-18', name: 'Vendredi Saint' },
    { date: '2025-05-19', name: 'Journée nationale des Patriotes' },
    { date: '2025-06-24', name: 'Fête nationale du Québec' },
    { date: '2025-07-01', name: 'Fête du Canada' },
    { date: '2025-09-01', name: 'Fête du Travail' },
    { date: '2025-10-13', name: 'Action de grâce' },
    { date: '2025-12-25', name: 'Noël' },
  ]);

  // Templates d'horaires
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  
  // Calcul d'heures
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [hoursCalculation, setHoursCalculation] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState('week'); // 'week' ou 'month'
  
  // Drag & Drop
  const [draggedCell, setDraggedCell] = useState(null);
  
  // États existants
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [employees, setEmployees] = useState({});
  const [schedules, setSchedules] = useState({});
  const schedulesRef = useRef(schedules);

  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

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
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [viewMode, setViewMode] = useState('week');
  const [weekDays, setWeekDays] = useState([]);
  const [monthViewDept, setMonthViewDept] = useState("Proposé à l'accueil");

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  // ========== NOUVELLES FONCTIONS ==========

  // OPTION 2: Calcul des heures travaillées
  const calculateHours = (schedule) => {
    if (!schedule || schedule === 'N/D' || schedule === '') return 0;
    
    const match = schedule.match(/(\d{1,2})h?(\d{2})?-(\d{1,2})h?(\d{2})?/);
    if (!match) return 0;
    
    const startHour = parseInt(match[1]);
    const startMin = match[2] ? parseInt(match[2]) : 0;
    const endHour = parseInt(match[3]);
    const endMin = match[4] ? parseInt(match[4]) : 0;
    
    const startTotal = startHour + startMin / 60;
    const endTotal = endHour + endMin / 60;
    
    return Math.max(0, endTotal - startTotal);
  };

  const calculateEmployeeHours = (empName, period = 'week') => {
    let totalHours = 0;
    let daysToCheck = [];
    
    if (period === 'week') {
      daysToCheck = getWeekDays(currentDate).slice(0, 7);
    } else {
      // Pour le mois complet - calculer tous les jours du mois actuel
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0); // Dernier jour du mois
      
      // Créer un tableau avec tous les jours du mois
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        daysToCheck.push(new Date(d));
      }
    }
    
    departments.forEach(dept => {
      if (employees[dept]?.includes(empName)) {
        daysToCheck.forEach(day => {
          const dateStr = getLocalDateString(day);
          const key = `${dept}-${empName}-${dateStr}`;
          const sched = schedules[key]?.schedule || '';
          totalHours += calculateHours(sched);
        });
      }
    });
    
    return totalHours.toFixed(2);
  };

  const calculateAllEmployeesHours = () => {
    const calculations = {};
    const allEmployees = new Set();
    
    departments.forEach(dept => {
      (employees[dept] || []).forEach(emp => allEmployees.add(emp));
    });
    
    allEmployees.forEach(emp => {
      calculations[emp] = {
        week: calculateEmployeeHours(emp, 'week'),
        month: calculateEmployeeHours(emp, 'month')
      };
    });
    
    return calculations;
  };

  const openHoursCalculator = () => {
    const calcs = calculateAllEmployeesHours();
    setHoursCalculation(calcs);
    setShowHoursModal(true);
  };

  // OPTION 3: Templates d'horaires PAR DÉPARTEMENT
  const saveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert('Veuillez entrer un nom pour le template');
      return;
    }
    
    if (!selectedDepartment) {
      alert('Veuillez sélectionner un département');
      return;
    }
    
    // Sauvegarder seulement le département sélectionné sur 7 jours
    const weekSchedules = {};
    const days = getWeekDays(currentDate).slice(0, 7);
    const dept = selectedDepartment;
    
    days.forEach((day, idx) => {
      (employees[dept] || []).forEach(emp => {
        const dateStr = getLocalDateString(day);
        const key = `${dept}-${emp}-${dateStr}`;
        const sched = schedules[key];
        // Sauvegarder même si vide pour permettre des templates vides
        weekSchedules[`day${idx}-${emp}`] = (sched && sched.schedule) ? sched.schedule : '';
      });
    });
    
    const template = {
      name: newTemplateName,
      department: dept,
      schedules: weekSchedules,
      employees: employees[dept] || [],
      createdAt: new Date().toISOString()
    };
    
    try {
      const docRef = await addDoc(collection(db, 'templates'), template);
      const newTemplate = { id: docRef.id, ...template };
      setTemplates([...templates, newTemplate]);
      setNewTemplateName('');
      setShowTemplateModal(false);
      alert(`Template "${newTemplateName}" sauvegardé pour ${dept}!`);
    } catch (error) {
      console.error('Erreur sauvegarde template:', error);
      alert('Erreur lors de la sauvegarde du template: ' + error.message);
    }
  };

  const applyDepartmentTemplate = async (deptName) => {
    // Trouver les templates pour ce département
    const deptTemplates = templates.filter(t => t.department === deptName);
    
    if (deptTemplates.length === 0) {
      alert(`Aucun template trouvé pour ${deptName}.\n\nCréez un template d'abord en mode Admin.`);
      return;
    }
    
    // Si plusieurs templates, demander lequel utiliser
    let selectedTemplate;
    if (deptTemplates.length === 1) {
      selectedTemplate = deptTemplates[0];
    } else {
      const templateNames = deptTemplates.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
      const choice = prompt(`Plusieurs templates disponibles pour ${deptName}:\n\n${templateNames}\n\nEntrez le numéro du template à appliquer:`);
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < deptTemplates.length) {
        selectedTemplate = deptTemplates[index];
      } else {
        alert('Choix invalide');
        return;
      }
    }
    
    if (!window.confirm(`Appliquer le template "${selectedTemplate.name}" à ${deptName} pour cette semaine?\n\nAttention: cela remplacera tous les horaires actuels de ce département.`)) {
      return;
    }
    
    const days = getWeekDays(currentDate).slice(0, 7);
    
    // Utiliser les employés ACTUELS du département (pas ceux du template)
    const currentEmployees = employees[deptName] || [];
    const templateEmployees = selectedTemplate.employees || [];
    
    console.log('📋 Application template:', selectedTemplate.name, 'pour', deptName);
    console.log('🗓️ Semaine:', days[0].toLocaleDateString(), 'au', days[6].toLocaleDateString());
    
    // Mettre à jour l'état local avec tous les horaires
    const newSchedules = { ...schedules };
    
    // Préparer les sauvegardes Firebase (seulement cette semaine)
    const firebaseUpdates = [];
    const firebaseDeletions = [];
    
    // Appliquer seulement pour ce département
    days.forEach((day, idx) => {
      currentEmployees.forEach(emp => {
        const dateStr = getLocalDateString(day);
        const key = `${deptName}-${emp}-${dateStr}`;
        
        // Chercher si cet employé existe dans le template
        const templateKey = `day${idx}-${emp}`;
        let scheduleValue = selectedTemplate.schedules[templateKey];
        
        // Si l'employé n'existe pas dans le template, essayer de copier depuis le premier employé du template
        if (scheduleValue === undefined && templateEmployees.length > 0) {
          const firstTemplateKey = `day${idx}-${templateEmployees[0]}`;
          scheduleValue = selectedTemplate.schedules[firstTemplateKey];
        }
        
        // Appliquer la valeur (même si vide, pour effacer)
        if (scheduleValue !== undefined) {
          if (scheduleValue === '') {
            // Supprimer l'horaire si le template est vide
            delete newSchedules[key];
            firebaseDeletions.push(key);
          } else {
            newSchedules[key] = { schedule: scheduleValue };
            firebaseUpdates.push({ key, value: scheduleValue });
          }
        }
      });
    });
    
    // Mettre à jour l'état local
    setSchedules(newSchedules);
    
    // Sauvegarder SEULEMENT les modifications de cette semaine dans Firebase
    console.log('💾 Sauvegarde:', firebaseUpdates.length, 'horaires +', firebaseDeletions.length, 'suppressions');
    
    try {
      // Supprimer les horaires vides
      for (const key of firebaseDeletions) {
        await deleteDoc(doc(db, 'schedules', key));
      }
      
      // Sauvegarder les nouveaux horaires
      for (const { key, value } of firebaseUpdates) {
        await setDoc(doc(db, 'schedules', key), { schedule: value });
      }
      
      console.log('✓ Template appliqué avec succès');
    } catch (error) {
      console.error('Erreur application template:', error);
      alert('Erreur lors de l\'application du template: ' + error.message);
    }
  };

  const applyTemplate = async (template) => {
    // Fonction conservée pour compatibilité - applique un template à son département
    if (!window.confirm(`Appliquer le template "${template.name}" à ${template.department} pour cette semaine?\n\nAttention: cela remplacera tous les horaires actuels de ce département.`)) {
      return;
    }
    
    const days = getWeekDays(currentDate).slice(0, 7);
    const dept = template.department;
    
    // Utiliser les employés ACTUELS du département (pas ceux du template)
    const currentEmployees = employees[dept] || [];
    const templateEmployees = template.employees || [];
    
    console.log('📋 Application template:', template.name, 'pour', dept);
    
    // Mettre à jour l'état local avec tous les horaires
    const newSchedules = { ...schedules };
    
    // Préparer les sauvegardes Firebase (seulement cette semaine)
    const firebaseUpdates = [];
    const firebaseDeletions = [];
    
    days.forEach((day, idx) => {
      currentEmployees.forEach(emp => {
        const dateStr = getLocalDateString(day);
        const key = `${dept}-${emp}-${dateStr}`;
        
        // Chercher si cet employé existe dans le template
        const templateKey = `day${idx}-${emp}`;
        let scheduleValue = template.schedules[templateKey];
        
        // Si l'employé n'existe pas dans le template, essayer de copier depuis le premier employé du template
        if (scheduleValue === undefined && templateEmployees.length > 0) {
          const firstTemplateKey = `day${idx}-${templateEmployees[0]}`;
          scheduleValue = template.schedules[firstTemplateKey];
        }
        
        // Appliquer la valeur (même si vide, pour effacer)
        if (scheduleValue !== undefined) {
          if (scheduleValue === '') {
            // Supprimer l'horaire si le template est vide
            delete newSchedules[key];
            firebaseDeletions.push(key);
          } else {
            newSchedules[key] = { schedule: scheduleValue };
            firebaseUpdates.push({ key, value: scheduleValue });
          }
        }
      });
    });
    
    // Mettre à jour l'état local
    setSchedules(newSchedules);
    
    // Sauvegarder SEULEMENT les modifications de cette semaine dans Firebase
    console.log('💾 Sauvegarde:', firebaseUpdates.length, 'horaires +', firebaseDeletions.length, 'suppressions');
    
    try {
      // Supprimer les horaires vides
      for (const key of firebaseDeletions) {
        await deleteDoc(doc(db, 'schedules', key));
      }
      
      // Sauvegarder les nouveaux horaires
      for (const { key, value } of firebaseUpdates) {
        await setDoc(doc(db, 'schedules', key), { schedule: value });
      }
      
      console.log('✓ Template appliqué avec succès');
    } catch (error) {
      console.error('Erreur application template:', error);
      alert('Erreur lors de l\'application du template: ' + error.message);
    }
  };

  const loadTemplates = async () => {
    try {
      const templatesSnap = await getDocs(collection(db, 'templates'));
      const loadedTemplates = [];
      templatesSnap.forEach(doc => {
        loadedTemplates.push({ id: doc.id, ...doc.data() });
      });
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('Erreur chargement templates:', error);
    }
  };

  const deleteTemplate = async (templateId, templateName) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le template "${templateName}" ?`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'templates', templateId));
      // Supprimer de l'état local
      setTemplates(templates.filter(t => t.id !== templateId));
      alert(`Template "${templateName}" supprimé avec succès!`);
    } catch (error) {
      console.error('Erreur suppression template:', error);
      alert('Erreur lors de la suppression du template: ' + error.message);
    }
  };

  // OPTION 4: Historique et Undo/Redo

  // OPTION 9: Jours fériés
  const isHoliday = (date) => {
    const dateStr = getLocalDateString(date);
    return holidays.find(h => h.date === dateStr);
  };

  // OPTION 5: Drag & Drop
  const handleDragStart = (e, dept, emp, day) => {
    if (!isAdmin) return;
    const sched = getSchedule(dept, emp, day);
    setDraggedCell({ dept, emp, day, schedule: sched.schedule });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetDept, targetEmp, targetDay) => {
    e.preventDefault();
    if (!isAdmin || !draggedCell) return;
    
    console.log('🎯 Drag-drop:', draggedCell.schedule);
    
    // COUPER/COLLER : Déplacer l'horaire de la cellule source vers la cible
    const sourceDateStr = getLocalDateString(draggedCell.day);
    const targetDateStr = getLocalDateString(targetDay);
    
    const sourceKey = `${draggedCell.dept}-${draggedCell.emp}-${sourceDateStr}`;
    const targetKey = `${targetDept}-${targetEmp}-${targetDateStr}`;
    
    const newSchedules = { ...schedules };
    
    // Déplacer l'horaire vers la cible
    newSchedules[targetKey] = { schedule: draggedCell.schedule };
    
    // EFFACER la source (couper au lieu de copier)
    delete newSchedules[sourceKey];
    
    setSchedules(newSchedules);
    setDraggedCell(null);
    
    // Sauvegarder SEULEMENT les 2 cellules modifiées
    try {
      // Sauvegarder la cible
      await setDoc(doc(db, 'schedules', targetKey), { schedule: draggedCell.schedule });
      console.log('✓ Copié vers:', targetKey);
      
      // Supprimer la source
      await deleteDoc(doc(db, 'schedules', sourceKey));
      console.log('✓ Supprimé:', sourceKey);
    } catch (error) {
      console.error('Erreur drag-drop:', error);
      alert('Erreur lors du déplacement: ' + error.message);
    }
  };

  // ========== FONCTIONS EXISTANTES (modifiées pour intégrer l'historique) ==========

  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    let unsubscribe;
    
    const initializeData = async () => {
      unsubscribe = await loadData();
      loadTemplates();
    };
    
    initializeData();
    
    // Nettoyage : arrêter les listeners quand le composant est démonté
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const days = viewMode === 'month' ? getCalendarDays() : getWeekDays(currentDate);
    setWeekDays(days);
  }, [currentDate, viewMode]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
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

      // Charger les employés une fois au démarrage
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

      // Écouter les changements des horaires en temps réel
      const unsubscribeSchedules = onSnapshot(collection(db, 'schedules'), (snapshot) => {
        const loadedSchedules = {};
        snapshot.forEach(docSnap => {
          loadedSchedules[docSnap.id] = docSnap.data();
        });
        setSchedules(loadedSchedules);
      }, (error) => {
        console.error('Erreur listener schedules:', error);
      });

      // Écouter les changements des employés en temps réel
      const unsubscribeEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
        const loadedEmployees = {};
        snapshot.forEach(docSnap => {
          loadedEmployees[docSnap.id] = docSnap.data().list || [];
        });
        setEmployees(loadedEmployees);
      }, (error) => {
        console.error('Erreur listener employees:', error);
      });

      setLoading(false);

      // Retourner la fonction de nettoyage pour arrêter les listeners
      return () => {
        unsubscribeSchedules();
        unsubscribeEmployees();
      };
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
      console.error('Erreur sauvegarde employés:', error);
    }
  };

  const saveSchedules = async (newSchedules) => {
    try {
      // Obtenir les clés actuelles de Firebase pour détecter les suppressions
      const currentKeys = Object.keys(schedules);
      const newKeys = Object.keys(newSchedules);
      
      // Détecter les clés supprimées
      const deletedKeys = currentKeys.filter(key => !newKeys.includes(key));
      
      console.log('💾 Sauvegarde en masse:', newKeys.length, 'horaires');
      
      // Supprimer les horaires effacés
      for (const key of deletedKeys) {
        try {
          await deleteDoc(doc(db, 'schedules', key));
        } catch (err) {
          console.error('Erreur suppression:', key, err);
        }
      }
      
      // Sauvegarder/mettre à jour les horaires
      for (const [key, value] of Object.entries(newSchedules)) {
        if (value && value.schedule) {
          try {
            await setDoc(doc(db, 'schedules', key), value);
          } catch (err) {
            console.error('Erreur sauvegarde:', key, err);
          }
        }
      }
      
      console.log('✓ Sauvegarde terminée');
      setShowSaveConfirmation(true);
      setTimeout(() => setShowSaveConfirmation(false), 2000);
    } catch (error) {
      console.error('Erreur sauvegarde horaires:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
    }
  };

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
  };

  const getSchedule = (dept, emp, day) => {
    const dateStr = getLocalDateString(day);
    const key = `${dept}-${emp}-${dateStr}`;
    return schedules[key] || { schedule: '' };
  };

  // Fonction pour déterminer le type de quart (matin/après-midi)
  const getShiftType = (schedule) => {
    if (!schedule || schedule === '' || schedule === 'N/D') {
      return schedule === 'N/D' ? 'nd' : '';
    }
    
    // Extraire l'heure de début
    const match = schedule.match(/(\d{1,2})h?(\d{2})?/);
    if (match) {
      const startHour = parseInt(match[1]);
      // Si commence avant 12h = matin (bleu), sinon après-midi (jaune)
      return startHour < 12 ? 'morning' : 'afternoon';
    }
    
    return '';
  };

  const updateSchedule = (dept, emp, day, value) => {
    console.log('=== UPDATE SCHEDULE ===');
    console.log('Dept:', dept, 'Emp:', emp, 'Value:', value);
    
    const dateStr = getLocalDateString(day);
    const key = `${dept}-${emp}-${dateStr}`;
    console.log('Clé:', key);
    
    const oldSchedules = { ...schedules };
    const newSchedules = {
      ...schedules,
      [key]: { schedule: value }
    };
    
    setSchedules(newSchedules);
    
    // Sauvegarder SEULEMENT cet horaire modifié
    setTimeout(async () => {
      try {
        if (value && value.trim() !== '') {
          await setDoc(doc(db, 'schedules', key), { schedule: value });
          console.log('✓ Sauvegardé:', key, '=', value);
        } else {
          // Si vide, supprimer de Firebase
          await deleteDoc(doc(db, 'schedules', key));
          console.log('✓ Supprimé:', key);
        }
      } catch (error) {
        console.error('Erreur sauvegarde:', error);
        alert('Erreur de sauvegarde: ' + error.message);
      }
    }, 500);
  };

  const addEmployee = async () => {
    if (!newEmployeeName.trim() || !selectedDepartment) return;

    const newEmployees = { ...employees };
    if (!newEmployees[selectedDepartment]) {
      newEmployees[selectedDepartment] = [];
    }
    newEmployees[selectedDepartment].push(newEmployeeName.trim());

    setEmployees(newEmployees);
    await saveEmployees(newEmployees);

    setShowAddEmployee(false);
    setNewEmployeeName('');
  };

  const handleDeleteClick = (dept, empName) => {
    setEmployeeToDelete({ dept, name: empName });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;

    const { dept, name } = employeeToDelete;
    const newEmployees = { ...employees };
    newEmployees[dept] = newEmployees[dept].filter(e => e !== name);

    const newSchedules = { ...schedules };
    Object.keys(newSchedules).forEach(key => {
      if (key.includes(`${dept}-${name}-`)) {
        delete newSchedules[key];
      }
    });

    setEmployees(newEmployees);
    setSchedules(newSchedules);

    await saveEmployees(newEmployees);
    await saveSchedules(newSchedules);
    setShowDeleteConfirm(false);
    setEmployeeToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setEmployeeToDelete(null);
  };

  const deleteSchedule = (dept, emp, day) => {
    updateSchedule(dept, emp, day, '');
  };

  const pasteSchedule = (dept, emp, day) => {
    if (copiedSchedule !== null) {
      updateSchedule(dept, emp, day, copiedSchedule);
    }
  };

  const changeWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const changeCalendarMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const days = [];
    let currentDay = new Date(startDate);

    while (days.length < 42) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return days;
  };

  const selectDateFromCalendar = (day) => {
    setCurrentDate(day);
    setShowCalendar(false);
  };

  const getWeekString = () => {
    const days = getWeekDays(currentDate);
    const start = days[0];
    const end = days[6];
    return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
  };

  const getNextWeekString = () => {
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const days = getWeekDays(nextWeekDate);
    const start = days[0];
    const end = days[6];
    return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
  };

  const getNextWeekDays = () => {
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    return getWeekDays(nextWeekDate);
  };

  const getMonthName = () => {
    return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'week' ? 'month' : 'week');
  };

  const handlePrint = () => {
    if (!selectedExportDept) {
      alert('Veuillez sélectionner un département à exporter');
      return;
    }

    // Supprimer ancien clone s'il existe
    const oldClone = document.querySelector('.print-clone');
    if (oldClone) {
      oldClone.remove();
    }

    // Créer le conteneur d'impression
    const printContainer = document.createElement('div');
    printContainer.className = viewMode === 'week' ? 'print-clone print-landscape' : 'print-clone';
    
    // Ajouter le logo
    const logoDiv = document.createElement('div');
    logoDiv.style.cssText = 'text-align: center; margin-bottom: 20px;';
    const logoImg = document.createElement('img');
    logoImg.src = logo;
    logoImg.style.cssText = 'height: 60px;';
    logoDiv.appendChild(logoImg);
    printContainer.appendChild(logoDiv);

    if (viewMode === 'week') {
      // ======== VUE HEBDOMADAIRE (LANDSCAPE) - 2 SEMAINES L'UNE EN DESSOUS DE L'AUTRE ========
      const week1Days = getWeekDays(currentDate).slice(0, 7);
      const week2Days = getNextWeekDays().slice(0, 7);
      
      // Titre avec les 2 dates
      const titleDiv = document.createElement('div');
      titleDiv.style.cssText = 'text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 15px;';
      titleDiv.innerHTML = `${selectedExportDept}<br><span style="font-size: 13px; font-weight: normal;">Semaine du ${getWeekString()} | Semaine du ${getNextWeekString()}</span>`;
      printContainer.appendChild(titleDiv);

      // SEMAINE 1
      const week1Title = document.createElement('div');
      week1Title.style.cssText = 'font-size: 14px; font-weight: bold; margin: 15px 0 8px 0; border-bottom: 2px solid #3b82f6; padding-bottom: 4px;';
      week1Title.textContent = `Semaine du ${getWeekString()}`;
      printContainer.appendChild(week1Title);

      const table1 = createWeekTable(selectedExportDept, week1Days);
      printContainer.appendChild(table1);

      // SEMAINE 2
      const week2Title = document.createElement('div');
      week2Title.style.cssText = 'font-size: 14px; font-weight: bold; margin: 25px 0 8px 0; border-bottom: 2px solid #10b981; padding-bottom: 4px; page-break-before: avoid;';
      week2Title.textContent = `Semaine du ${getNextWeekString()}`;
      printContainer.appendChild(week2Title);

      const table2 = createWeekTable(selectedExportDept, week2Days);
      printContainer.appendChild(table2);

    } else {
      // ======== VUE MENSUELLE (PORTRAIT) ========
      const titleDiv = document.createElement('div');
      titleDiv.style.cssText = 'text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 15px;';
      titleDiv.innerHTML = `${selectedExportDept}<br><span style="font-size: 13px; font-weight: normal;">${getMonthName()}</span>`;
      printContainer.appendChild(titleDiv);

      // Créer calendrier mensuel
      const monthTable = createMonthTable();
      printContainer.appendChild(monthTable);
    }

    // Ajouter au body
    document.body.appendChild(printContainer);

    // Lancer l'impression
    setTimeout(() => {
      window.print();
      // Nettoyer après impression
      setTimeout(() => {
        printContainer.remove();
      }, 500);
    }, 100);
  };

  // Fonction pour créer une table hebdomadaire
  const createWeekTable = (dept, days) => {
    const table = document.createElement('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;';

    // En-tête
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const thEmp = document.createElement('th');
    thEmp.textContent = 'Employé';
    thEmp.style.cssText = 'border: 1px solid #e5e7eb; padding: 6px; background: #f3f4f6; text-align: left; font-weight: bold;';
    headerRow.appendChild(thEmp);

    days.forEach(day => {
      const th = document.createElement('th');
      const holiday = isHoliday(day);
      th.innerHTML = `<div style="font-weight: bold;">${dayNames[day.getDay()]}</div><div style="font-size: 10px;">${day.getDate()} ${monthNames[day.getMonth()]}</div>`;
      if (holiday) {
        th.innerHTML += `<div style="font-size: 9px; color: #f59e0b;">${holiday.name}</div>`;
      }
      th.style.cssText = 'border: 1px solid #e5e7eb; padding: 6px; background: #f3f4f6; text-align: center; min-width: 90px;';
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Corps
    const tbody = document.createElement('tbody');
    (employees[dept] || []).forEach(emp => {
      const row = document.createElement('tr');
      
      const tdEmp = document.createElement('td');
      tdEmp.textContent = emp;
      tdEmp.style.cssText = 'border: 1px solid #e5e7eb; padding: 6px; font-weight: 500; background: #fafafa;';
      row.appendChild(tdEmp);

      days.forEach(day => {
        const sched = getSchedule(dept, emp, day);
        const td = document.createElement('td');
        td.textContent = sched.schedule || '';
        td.style.cssText = 'border: 1px solid #e5e7eb; padding: 6px; text-align: center; font-weight: 600;';
        
        // Appliquer les couleurs
        const shiftType = getShiftType(sched.schedule);
        if (shiftType === 'nd') {
          td.style.background = '#fecaca';
          td.style.color = '#991b1b';
        } else if (shiftType === 'morning') {
          td.style.background = '#dbeafe';
          td.style.color = '#1e40af';
        } else if (shiftType === 'afternoon') {
          td.style.background = '#fef08a';
          td.style.color = '#854d0e';
        }
        
        row.appendChild(td);
      });

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    return table;
  };

  // Fonction pour créer le calendrier mensuel
  const createMonthTable = () => {
    const container = document.createElement('div');
    container.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;';

    const calendarDays = getCalendarDays();
    
    // En-têtes des jours
    ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].forEach(dayName => {
      const header = document.createElement('div');
      header.textContent = dayName;
      header.style.cssText = 'background: #f3f4f6; padding: 8px; text-align: center; font-weight: bold; border: 1px solid #e5e7eb; font-size: 11px;';
      container.appendChild(header);
    });

    // Jours du calendrier
    calendarDays.forEach(day => {
      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
      const cell = document.createElement('div');
      cell.style.cssText = `border: 1px solid #e5e7eb; padding: 4px; min-height: 80px; ${!isCurrentMonth ? 'opacity: 0.3;' : ''}`;
      
      const dateDiv = document.createElement('div');
      dateDiv.textContent = day.getDate();
      dateDiv.style.cssText = 'font-weight: bold; margin-bottom: 4px; font-size: 12px;';
      cell.appendChild(dateDiv);

      const holiday = isHoliday(day);
      if (holiday) {
        const holidayDiv = document.createElement('div');
        holidayDiv.textContent = '🎉';
        holidayDiv.style.cssText = 'font-size: 10px;';
        dateDiv.appendChild(holidayDiv);
      }

      // Horaires
      (employees[selectedExportDept] || []).forEach(emp => {
        const sched = getSchedule(selectedExportDept, emp, day);
        if (sched.schedule) {
          const schedDiv = document.createElement('div');
          schedDiv.style.cssText = 'font-size: 9px; padding: 2px 4px; margin: 2px 0; border-radius: 3px;';
          schedDiv.innerHTML = `<span style="font-weight: 600;">${emp.split(' ')[0]}</span> ${sched.schedule}`;
          
          const shiftType = getShiftType(sched.schedule);
          if (shiftType === 'nd') {
            schedDiv.style.background = '#fecaca';
            schedDiv.style.color = '#991b1b';
          } else if (shiftType === 'morning') {
            schedDiv.style.background = '#dbeafe';
            schedDiv.style.color = '#1e40af';
          } else if (shiftType === 'afternoon') {
            schedDiv.style.background = '#fef08a';
            schedDiv.style.color = '#854d0e';
          }
          
          cell.appendChild(schedDiv);
        }
      });

      container.appendChild(cell);
    });

    return container;
  };

  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-content">
        {/* Header */}
        <div className="header-card sticky-header">
          <div className="header-title-section">
            <img src={logo} alt="Logo" className="logo" />
            <h1>Gestion des Horaires</h1>
            <button
              onClick={isAdmin ? handleAdminLogout : () => setShowPasswordModal(true)}
              className="icon-admin-btn"
              title={isAdmin ? "Déconnexion" : "Mode Administrateur"}
            >
              {isAdmin ? <Unlock size={24} /> : <Lock size={24} />}
            </button>
          </div>

          {/* Nouvelle rangée compacte pour navigation et filtres */}
          <div className="compact-header-row">
            <div className="nav-controls-group">
              <button onClick={() => viewMode === 'month' ? changeCalendarMonth(-1) : changeWeek(-1)} className="nav-btn-compact">
                <ChevronLeft size={16} />
              </button>
              <button onClick={goToToday} className="btn-today-compact">
                Aujourd'hui
              </button>
              <button onClick={() => viewMode === 'month' ? changeCalendarMonth(1) : changeWeek(1)} className="nav-btn-compact">
                <ChevronRight size={16} />
              </button>
              <button onClick={() => setShowCalendar(true)} className="btn-calendar-compact">
                <Calendar size={16} />
              </button>
              <button onClick={toggleViewMode} className="view-mode-btn-compact">
                {viewMode === 'week' ? '📅 Semaine' : '📆 Mois'}
              </button>
            </div>

            {/* Filtres départements */}
            <div className="dept-filter-compact">
              <button
                onClick={() => setVisibleDepartment('Tous')}
                className={`filter-btn-compact ${visibleDepartment === 'Tous' ? 'active' : ''}`}
              >
                Tous
              </button>
              {departments.map(dept => (
                <button
                  key={dept}
                  onClick={() => setVisibleDepartment(dept)}
                  className={`filter-btn-compact ${visibleDepartment === dept ? 'active' : ''}`}
                >
                  {dept.replace('Proposé ', '').replace('à l\'', '').replace('aux ', '').replace('au ', '')}
                </button>
              ))}
            </div>

            {/* NOUVEAU: Boutons pour les nouvelles fonctionnalités */}
            {isAdmin && (
              <div className="nav-controls-group">
                <button onClick={openHoursCalculator} className="nav-btn-compact" title="Calculer les heures">
                  <Clock size={16} />
                </button>
                <button onClick={() => setShowTemplateModal(true)} className="nav-btn-compact" title="Sauvegarder template">
                  <Save size={16} />
                </button>
                <button 
                  onClick={() => window.open('https://messages.google.com/web', '_blank')} 
                  className="nav-btn-compact" 
                  title="Envoyer SMS via Google Messages"
                >
                  <MessageSquare size={16} />
                </button>
              </div>
            )}

            {/* Export/Print/SMS */}
            <div className="export-compact">
              <span className="export-label-compact">Exporter:</span>
              <select
                value={selectedExportDept}
                onChange={(e) => setSelectedExportDept(e.target.value)}
                className="dropdown-select-compact"
              >
                <option value="">Tous les départements</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept.replace('Proposé ', '').replace('à l\'', '').replace('aux ', '').replace('au ', '')}
                  </option>
                ))}
              </select>
              <button onClick={handlePrint} className="export-print-btn-compact" title="Imprimer">
                <Printer size={14} />
              </button>
            </div>
          </div>

          {/* Titre de la semaine/mois */}
          <div className="month-title-banner">
            <span className="screen-only">
              {viewMode === 'week' ? `Semaine du ${getWeekString()}` : getMonthName()}
            </span>
            <span className="print-only">
              {viewMode === 'week' ? `Semaine du ${getWeekString()} | Semaine du ${getNextWeekString()}` : getMonthName()}
            </span>
          </div>

          {/* Sauvegarde automatique */}
          {showSaveConfirmation && (
            <div style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              background: '#10b981',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              zIndex: 1000,
              animation: 'fadeIn 0.3s'
            }}>
              ✓ Sauvegardé automatiquement
            </div>
          )}
        </div>

        {/* Vue hebdomadaire ou mensuelle */}
        {viewMode === 'week' ? (
          // VUE HEBDOMADAIRE
          <div>
            {departments
              .filter(dept => visibleDepartment === 'Tous' || visibleDepartment === dept)
              .map(dept => (
                <div key={dept} className="schedule-section">
                  <div className="section-header">
                    <h2 className="section-title">{dept}</h2>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setSelectedDepartment(dept);
                          setShowAddEmployee(true);
                        }}
                        className="btn-add-emp"
                      >
                        <Plus size={20} /> Ajouter Employé
                      </button>
                    )}
                  </div>

                  <div className="table-container">
                    <table className="schedule-table">
                      <thead>
                        <tr>
                          <th className="sticky-col">Employé</th>
                          {/* Semaine 1 (toujours visible) */}
                          {weekDays.slice(0, 7).map((day, idx) => {
                            const holiday = isHoliday(day);
                            const isToday = day.toDateString() === new Date().toDateString();
                            return (
                              <th key={idx} className={`day-header ${isToday ? 'today-header' : ''}`}>
                                <div className="day-name">{dayNames[day.getDay()]}</div>
                                <div className="day-date">{day.getDate()} {monthNames[day.getMonth()]}</div>
                                {holiday && <div className="holiday-badge">{holiday.name}</div>}
                              </th>
                            );
                          })}
                          {/* Semaine 2 (visible seulement à l'impression) */}
                          {getNextWeekDays().slice(0, 7).map((day, idx) => {
                            const holiday = isHoliday(day);
                            const isToday = day.toDateString() === new Date().toDateString();
                            return (
                              <th key={`next-${idx}`} className={`day-header print-only ${isToday ? 'today-header' : ''}`}>
                                <div className="day-name">{dayNames[day.getDay()]}</div>
                                <div className="day-date">{day.getDate()} {monthNames[day.getMonth()]}</div>
                                {holiday && <div className="holiday-badge">{holiday.name}</div>}
                              </th>
                            );
                          })}
                          {isAdmin && <th className="screen-only">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(employees[dept] || []).map(emp => (
                          <tr key={emp}>
                            <td className="sticky-col employee-cell">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{emp}</span>
                              </div>
                            </td>
                            {/* Semaine 1 (toujours visible) */}
                            {weekDays.slice(0, 7).map((day, idx) => {
                              const sched = getSchedule(dept, emp, day);
                              const isSelected = selectedCell?.dept === dept && selectedCell?.emp === emp && 
                                               getLocalDateString(selectedCell.day) === getLocalDateString(day);
                              const isEditing = editingCell?.dept === dept && editingCell?.emp === emp && 
                                              getLocalDateString(editingCell.day) === getLocalDateString(day);
                              const shiftType = getShiftType(sched.schedule);
                              const shiftClass = shiftType === 'nd' ? 'nd-cell' : shiftType === 'morning' ? 'morning-shift' : shiftType === 'afternoon' ? 'afternoon-shift' : '';
                              
                              return (
                                <td
                                  key={idx}
                                  className={`schedule-cell ${isSelected ? 'selected-cell' : ''} ${shiftClass}`}
                                  onClick={() => {
                                    if (isAdmin) setSelectedCell({ dept, emp, day });
                                  }}
                                  draggable={isAdmin}
                                  onDragStart={(e) => handleDragStart(e, dept, emp, day)}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, dept, emp, day)}
                                >
                                  {isAdmin ? (
                                    <div>
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={editingValue}
                                          onChange={(e) => setEditingValue(e.target.value)}
                                          onBlur={() => {
                                            if (editingValue.trim()) {
                                              updateSchedule(dept, emp, day, editingValue);
                                            }
                                            setEditingCell(null);
                                            setEditingValue('');
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              if (editingValue.trim()) {
                                                updateSchedule(dept, emp, day, editingValue);
                                              }
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
                                        <div className="cell-actions" style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                          <select
                                            value={sched.schedule}
                                            onChange={(e) => {
                                              updateSchedule(dept, emp, day, e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="schedule-input schedule-select"
                                            style={{ flex: 1, minWidth: '0' }}
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
                                            style={{ padding: '2px 4px', fontSize: '11px' }}
                                          >
                                            ✏️
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="time-display">
                                      {sched.schedule}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            {/* Semaine 2 (visible seulement à l'impression) */}
                            {getNextWeekDays().slice(0, 7).map((day, idx) => {
                              const sched = getSchedule(dept, emp, day);
                              const shiftType = getShiftType(sched.schedule);
                              const shiftClass = shiftType === 'nd' ? 'nd-cell' : shiftType === 'morning' ? 'morning-shift' : shiftType === 'afternoon' ? 'afternoon-shift' : '';
                              return (
                                <td
                                  key={`next-${idx}`}
                                  className={`schedule-cell print-only ${shiftClass}`}
                                >
                                  <div className="time-display">
                                    {sched.schedule}
                                  </div>
                                </td>
                              );
                            })}
                            {isAdmin && (
                              <td className="screen-only">
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
                      <button 
                        onClick={() => applyDepartmentTemplate(dept)} 
                        className="btn-copy"
                        title="Appliquer un template à ce département"
                      >
                        📋 Copier Template {dept.replace('Proposé ', '').replace('à l\'', '').replace('aux ', '').replace('au ', '')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        ) : (
          // VUE MENSUELLE
          <div className="month-calendar-view">
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={monthViewDept}
                onChange={(e) => setMonthViewDept(e.target.value)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '6px 12px' }}>
                  <span>✏️</span>
                  <span>Mode Admin — cliquez sur un quart pour modifier</span>
                </div>
              )}
            </div>

            <div className="month-calendar-header">
              {['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map(dayName => (
                <div key={dayName} className="month-calendar-day-name">{dayName}</div>
              ))}
            </div>

            <div className="month-calendar-grid">
              {weekDays.map((day, idx) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = day.toDateString() === new Date().toDateString();
                const holiday = isHoliday(day);
                const deptEmployees = employees[monthViewDept] || [];
                const dateStr = getLocalDateString(day);

                // Trouver les employés assignés à ce jour pour ce département
                // Quart 1 = premier employé avec un horaire matin
                // Quart 2 = premier employé avec un horaire après-midi
                // En mode admin on permet d'éditer 2 quarts indépendants
                const assignedShifts = deptEmployees
                  .map(emp => ({ emp, sched: getSchedule(monthViewDept, emp, day) }))
                  .filter(({ sched }) => sched.schedule);

                // Séparer matin / après-midi
                const morningShifts = assignedShifts.filter(({ sched }) => getShiftType(sched.schedule) === 'morning' || sched.schedule === 'N/D');
                const afternoonShifts = assignedShifts.filter(({ sched }) => getShiftType(sched.schedule) === 'afternoon');

                // Presets du département
                const presets = departmentPresets[monthViewDept] || [];
                const morningPresets = presets.filter(p => {
                  const match = p.match(/^(\d{1,2})h/);
                  return match && parseInt(match[1]) < 12;
                });
                const afternoonPresets = presets.filter(p => {
                  const match = p.match(/^(\d{1,2})h/);
                  return match && parseInt(match[1]) >= 12;
                });

                const renderShiftBadge = ({ emp, sched }) => {
                  const shiftType = getShiftType(sched.schedule);
                  let bgColor, textColor;
                  if (shiftType === 'nd') { bgColor = '#fecaca'; textColor = '#991b1b'; }
                  else if (shiftType === 'morning') { bgColor = '#dbeafe'; textColor = '#1e40af'; }
                  else if (shiftType === 'afternoon') { bgColor = '#fef08a'; textColor = '#854d0e'; }
                  else { bgColor = '#e5e7eb'; textColor = '#6b7280'; }

                  return (
                    <div key={emp} className="month-schedule-item" style={{ background: bgColor, color: textColor }}>
                      <span className="emp-name-short">{emp.split(' ')[0]}</span>
                      <span className="schedule-time">{sched.schedule}</span>
                    </div>
                  );
                };

                const MonthAdminShiftRow = ({ shiftLabel, shiftColor, existingShifts, availablePresets, isAfternoon }) => {
                  // Trouver l'employé actuel pour ce quart (prendre le premier)
                  const currentShift = existingShifts[0];
                  const currentEmp = currentShift ? currentShift.emp : '';
                  const currentSched = currentShift ? currentShift.sched.schedule : '';

                  return (
                    <div style={{
                      border: `1px solid ${shiftColor}33`,
                      borderRadius: '4px',
                      padding: '3px',
                      marginBottom: '2px',
                      background: `${shiftColor}11`
                    }}>
                      <div style={{ fontSize: '9px', fontWeight: '600', color: shiftColor, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        {shiftLabel}
                      </div>
                      {/* Menu employé */}
                      <select
                        value={currentEmp}
                        onChange={(e) => {
                          const newEmp = e.target.value;
                          // Si on change d'employé, on efface l'ancien et assigne le même horaire au nouvel employé
                          if (currentEmp && currentEmp !== newEmp) {
                            updateSchedule(monthViewDept, currentEmp, day, '');
                          }
                          if (newEmp && currentSched) {
                            updateSchedule(monthViewDept, newEmp, day, currentSched);
                          } else if (newEmp && availablePresets.length > 0) {
                            updateSchedule(monthViewDept, newEmp, day, availablePresets[0]);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%',
                          fontSize: '10px',
                          padding: '1px 2px',
                          border: '1px solid #d1d5db',
                          borderRadius: '3px',
                          background: 'white',
                          marginBottom: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Employé --</option>
                        {deptEmployees.map(emp => (
                          <option key={emp} value={emp}>{emp.split(' ')[0]} {emp.split(' ')[1]?.[0] || ''}.</option>
                        ))}
                      </select>
                      {/* Menu heures */}
                      <select
                        value={currentSched}
                        onChange={(e) => {
                          const newSched = e.target.value;
                          if (currentEmp) {
                            updateSchedule(monthViewDept, currentEmp, day, newSched);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!currentEmp}
                        style={{
                          width: '100%',
                          fontSize: '10px',
                          padding: '1px 2px',
                          border: '1px solid #d1d5db',
                          borderRadius: '3px',
                          background: currentEmp ? 'white' : '#f9fafb',
                          cursor: currentEmp ? 'pointer' : 'not-allowed',
                          opacity: currentEmp ? 1 : 0.6
                        }}
                      >
                        <option value="">-- Horaire --</option>
                        <option value="N/D">N/D</option>
                        {availablePresets.map((p, i) => (
                          <option key={i} value={p}>{p}</option>
                        ))}
                        {currentSched && currentSched !== 'N/D' && !availablePresets.includes(currentSched) && (
                          <option value={currentSched}>{currentSched}</option>
                        )}
                      </select>
                      {/* Bouton supprimer si assigné */}
                      {currentEmp && currentSched && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSchedule(monthViewDept, currentEmp, day, '');
                          }}
                          style={{
                            marginTop: '2px',
                            width: '100%',
                            fontSize: '9px',
                            padding: '1px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          🗑 Effacer
                        </button>
                      )}
                    </div>
                  );
                };

                return (
                  <div
                    key={idx}
                    className={`month-calendar-cell ${!isCurrentMonth ? 'other-month-cell' : ''} ${isToday ? 'today-cell' : ''} ${isAdmin && isCurrentMonth ? 'admin-cell' : ''}`}
                  >
                    <div className="month-calendar-date">
                      {day.getDate()}
                      {holiday && <span className="holiday-indicator" title={holiday.name}>🎉</span>}
                    </div>

                    {isAdmin && isCurrentMonth ? (
                      // MODE ADMIN : 2 quarts éditables
                      <div className="month-calendar-schedules" style={{ gap: '2px' }}>
                        <MonthAdminShiftRow
                          shiftLabel="Matin"
                          shiftColor="#1e40af"
                          existingShifts={morningShifts}
                          availablePresets={morningPresets.length > 0 ? morningPresets : presets}
                          isAfternoon={false}
                        />
                        <MonthAdminShiftRow
                          shiftLabel="Après-midi"
                          shiftColor="#854d0e"
                          existingShifts={afternoonShifts}
                          availablePresets={afternoonPresets.length > 0 ? afternoonPresets : presets}
                          isAfternoon={true}
                        />
                      </div>
                    ) : (
                      // MODE LECTURE : affichage normal
                      <div className="month-calendar-schedules">
                        {assignedShifts.map(renderShiftBadge)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========== NOUVEAUX MODALS ========== */}

      {/* Modal: Calculateur d'heures */}
      {showHoursModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <h3>📊 Calcul des Heures Travaillées</h3>
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => setSelectedPeriod('week')}
                style={{
                  padding: '8px 16px',
                  marginRight: '8px',
                  background: selectedPeriod === 'week' ? '#3b82f6' : '#e5e7eb',
                  color: selectedPeriod === 'week' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Semaine
              </button>
              <button
                onClick={() => setSelectedPeriod('month')}
                style={{
                  padding: '8px 16px',
                  background: selectedPeriod === 'month' ? '#3b82f6' : '#e5e7eb',
                  color: selectedPeriod === 'month' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Mois
              </button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Employé</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Heures</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(hoursCalculation).map(([emp, hours]) => {
                    const displayHours = selectedPeriod === 'week' ? hours.week : hours.month;
                    return (
                      <tr key={emp} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px' }}>{emp}</td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: '#059669'
                        }}>
                          {displayHours}h
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal-buttons" style={{ marginTop: '16px' }}>
              <button onClick={() => setShowHoursModal(false)} className="modal-btn secondary">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Sauvegarder Template PAR DÉPARTEMENT */}
      {showTemplateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>💾 Sauvegarder Template de Département</h3>
            <p style={{ marginBottom: '16px', color: '#6b7280' }}>
              Sauvegarder les horaires d'un département sur 7 jours comme modèle réutilisable
            </p>
            
            {/* Sélection du département */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Département:
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="modal-input"
                style={{ marginBottom: '12px' }}
              >
                <option value="">-- Sélectionnez un département --</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            
            {/* Nom du template */}
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && saveAsTemplate()}
              placeholder="Nom du template (ex: Été - Accueil)"
              className="modal-input"
              disabled={!selectedDepartment}
            />
            
            {templates.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ marginBottom: '12px' }}>Templates existants:</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {templates.map((template, idx) => (
                    <div key={idx} style={{
                      padding: '12px',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{ fontWeight: '500' }}>{template.name}</span>
                        <br />
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {template.department}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setShowTemplateModal(false);
                            applyTemplate(template);
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Appliquer
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id, template.name)}
                          style={{
                            padding: '6px 12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Supprimer ce template"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="modal-buttons">
              <button 
                onClick={saveAsTemplate} 
                className="modal-btn primary"
                disabled={!selectedDepartment || !newTemplateName.trim()}
              >
                Sauvegarder
              </button>
              <button onClick={() => {
                setShowTemplateModal(false);
                setNewTemplateName('');
                setSelectedDepartment('');
              }} className="modal-btn secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}


      {/* ========== MODALS EXISTANTS ========== */}

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
              autoFocus
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
