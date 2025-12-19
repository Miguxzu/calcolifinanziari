// ===============================
// Costanti fiscali 2025 (MVP)
// ===============================

// Scaglioni IRPEF 2025
const SCAGLIONI_IRPEF_2025 = [
  { limite: 28000, aliquota: 0.23 },
  { limite: 50000, aliquota: 0.35 },
  { limite: Infinity, aliquota: 0.43 }
];

// Contributi INPS lavoratore dipendente (media)
const CONTRIBUTI_INPS = 0.0919; // 9,19%

// Addizionali medie (Lombardia + comune medio)
const ADDIZIONALI = {
  regionale: 0.0173, // 1,73%
  comunale: 0.0080   // 0,80%
};

// No tax area di fatto (con detrazioni lavoro)
const NO_TAX_AREA = 8500;


// ===============================
// Classe principale calcolatore
// ===============================

class CalcolatoreStipendio {
  constructor() {
    this.initEventListeners();
    this.setupUI();
  }

  // ---------------------------
  // Init eventi
  // ---------------------------
  initEventListeners() {
    const btnNettoAnnuo = document.getElementById('calcola-stipendio-netto');
    const btnNettoMensile = document.getElementById('calcola-netto-mensile');
    const figliSotto3 = document.getElementById('figliSotto3Anni');
    const figliDisabili = document.getElementById('figliDisabili');
    const numeroFigli = document.getElementById('numeroFigli');

    if (btnNettoAnnuo) {
      btnNettoAnnuo.addEventListener('click', () => {
        this.calcolaStipendio('annuale');
      });
    }

    if (btnNettoMensile) {
      btnNettoMensile.addEventListener('click', () => {
        this.calcolaStipendio('mensile');
      });
    }

    this.setupPulisciButton();

    // Validazioni sui figli
    if (numeroFigli) {
      numeroFigli.addEventListener('change', () => this.validazioneFigli());
    }
    if (figliSotto3) {
      figliSotto3.addEventListener('change', () => this.validazioneFigli());
    }
    if (figliDisabili) {
      figliDisabili.addEventListener('change', () => this.validazioneFigli());
    }
  }

  setupUI() {
    // Nessun setup extra per ora (MVP)
  }

  // ---------------------------
  // Validazioni
  // ---------------------------
  validazioneFigli() {
    const totaleFigli = parseInt(document.getElementById('numeroFigli')?.value) || 0;
    const sotto3Anni = parseInt(document.getElementById('figliSotto3Anni')?.value) || 0;
    const disabili = parseInt(document.getElementById('figliDisabili')?.value) || 0;

    const nuoviSotto3 = Math.min(sotto3Anni, totaleFigli);
    const nuoviDisabili = Math.min(disabili, totaleFigli);

    document.getElementById('figliSotto3Anni').value = nuoviSotto3;
    document.getElementById('figliDisabili').value = nuoviDisabili;
  }

  // ---------------------------
  // Calcolo principale
  // ---------------------------
  calcolaStipendio(tipo) {
    const RAL = this.getRALInput();
    if (!RAL || RAL <= 0) {
      alert('⚠️ Inserisci un lordo mensile valido.');
      return;
    }

    const situazione = this.getSituazionePersonale();

    // 1) Contributi INPS
    const contributiINPS = this.calcolaContributiINPS(RAL, situazione);

    // 2) Base imponibile IRPEF
    const baseImponibileIRPEF = Math.max(0, RAL - contributiINPS);

    // 3) IRPEF lorda
    const irpefLorda = this.calcolaIRPEFLorda(baseImponibileIRPEF);

    // 4) Detrazioni
    const detrazioniLavoro = this.calcolaDetrazioneLavoro(baseImponibileIRPEF);
    const detrazioniFamiliari = this.calcolaDetrazioneFamiliari(baseImponibileIRPEF, situazione);
    const totaleDetrazioni = detrazioniLavoro + detrazioniFamiliari;

    const irpefNetta = Math.max(0, irpefLorda - totaleDetrazioni);

    // 5) Addizionali
    const addizionali = this.calcolaAddizionali(baseImponibileIRPEF);

    // 6) Netto annuo
    const nettoAnnuale = RAL
      - contributiINPS
      - irpefNetta
      - addizionali.regionale
      - addizionali.comunale;

    const nettoMensile = this.calcolaNettoMensile(nettoAnnuale, tipo, situazione);
    const nettoMensileCon13 = situazione.tredicesima
      ? nettoAnnuale / 13
      : nettoAnnuale / 12;

    this.mostraRisultati({
      RAL,
      contributiINPS,
      baseImponibileIRPEF,
      irpefLorda,
      detrazioniLavoro,
      detrazioniFamiliari,
      irpefNetta,
      addizionali,
      nettoAnnuale,
      nettoMensile,
      nettoMensileCon13,
      mensilita: situazione.tredicesima ? 13 : 12
    }, tipo, situazione);
  }

  // ---------------------------
  // Lettura input
  // ---------------------------
  getRALInput() {
    const lordoMensile = parseFloat(document.getElementById('lordo')?.value);
    if (!lordoMensile || lordoMensile <= 0) return 0;

    const situazione = this.getSituazionePersonale();
    const lordoMensileEffettivo = lordoMensile * (situazione.percentualePartTime / 100);
    return lordoMensileEffettivo * (situazione.tredicesima ? 13 : 12);
  }

  getSituazionePersonale() {
    return {
      conConiuge: document.getElementById('conConiuge')?.checked || false,
      numeroFigli: parseInt(document.getElementById('numeroFigli')?.value) || 0,
      figliSotto3Anni: parseInt(document.getElementById('figliSotto3Anni')?.value) || 0,
      figliDisabili: parseInt(document.getElementById('figliDisabili')?.value) || 0,
      altriCarichi: document.getElementById('altriCarichi')?.checked || false,
      regimeForfettario: document.getElementById('regimeForfettario')?.checked || false,
      partTime: document.getElementById('partTime')?.checked || false,
      percentualePartTime: parseInt(document.getElementById('percentualePartTime')?.value) || 100,
      tredicesima: document.getElementById('tredicesima')?.checked || false
    };
  }

  // ---------------------------
  // Calcoli fiscali
  // ---------------------------
  calcolaContributiINPS(RAL, situazione) {
    if (situazione.regimeForfettario) {
      return RAL * 0.05;
    }
    return RAL * CONTRIBUTI_INPS;
  }

  calcolaIRPEFLorda(baseImponibile) {
    if (baseImponibile <= 0) return 0;

    let irpefTotale = 0;
    let redditoResiduo = baseImponibile;
    let scaglionePrecedente = 0;

    for (const scaglione of SCAGLIONI_IRPEF_2025) {
      if (redditoResiduo <= 0) break;

      const scaglioneImponibile = Math.min(
        redditoResiduo,
        scaglione.limite - scaglionePrecedente
      );

      if (scaglioneImponibile > 0) {
        irpefTotale += scaglioneImponibile * scaglione.aliquota;
      }

      redditoResiduo -= scaglioneImponibile;
      scaglionePrecedente = scaglione.limite;
    }

    return irpefTotale;
  }

  // Detrazione lavoro dipendente (MVP 2025)
  calcolaDetrazioneLavoro(baseImponibile) {
    if (baseImponibile <= 0) return 0;

    if (baseImponibile <= 15000) {
      return 1955;
    }

    if (baseImponibile <= 28000) {
      return 1910 + 1190 * ((28000 - baseImponibile) / 13000);
    }

    if (baseImponibile <= 50000) {
      return 1910 * ((50000 - baseImponibile) / 22000);
    }

    return 0;
  }

  // Detrazioni familiari (semplificate ma usando tutti i campi)
  calcolaDetrazioneFamiliari(baseImponibile, situazione) {
    let totale = 0;

    // 1) Coniuge a carico (schema semplificato)
    if (situazione.conConiuge && baseImponibile <= 80000) {
      if (baseImponibile <= 15000) {
        totale += 800;
      } else if (baseImponibile <= 40000) {
        totale += 800 - ((baseImponibile - 15000) * (800 - 690) / 25000);
      } else {
        totale += Math.max(0, 690 - ((baseImponibile - 40000) * 690 / 40000));
      }
    }

    // 2) Figli a carico (MVP: considerati come figli ≥ 21 anni ai fini IRPEF)
    const nFigli = situazione.numeroFigli;
    const sotto3 = situazione.figliSotto3Anni;
    const disabili = situazione.figliDisabili;

    if (nFigli > 0 && baseImponibile <= 95000) {
      // Detrazione base per figlio maggiorenne
      let basePerFiglio = 950; // valore indicativo
      // Maggiorazione per figli sotto 3 anni
      let bonusUnder3 = 200;
      // Maggiorazione per figli disabili
      let bonusDisabile = 350;

      // Scaliamo con il reddito: oltre ~50k le detrazioni si riducono molto
      const fattoreReddito = baseImponibile <= 50000
        ? 1
        : Math.max(0, 1 - (baseImponibile - 50000) / 45000);

      const figliNormali = Math.max(0, nFigli - sotto3 - disabili);
      const quotaFigliNormali = figliNormali * basePerFiglio;
      const quotaUnder3 = Math.min(sotto3, nFigli) * (basePerFiglio + bonusUnder3);
      const quotaDisabili = Math.min(disabili, nFigli) * (basePerFiglio + bonusDisabile);

      totale += (quotaFigliNormali + quotaUnder3 + quotaDisabili) * fattoreReddito;
    }

    // 3) Altri familiari a carico (es. genitori) → somma flat
    if (situazione.altriCarichi && baseImponibile <= 80000) {
      totale += 750; // valore forfettario MVP
    }

    return totale;
  }

  calcolaAddizionali(baseImponibile) {
    return {
      regionale: baseImponibile * ADDIZIONALI.regionale,
      comunale: baseImponibile * ADDIZIONALI.comunale
    };
  }

  calcolaNettoMensile(nettoAnnuale, tipo, situazione) {
    const mensilita = situazione.tredicesima ? 13 : 12;
    return nettoAnnuale / mensilita;
  }

  // ---------------------------
  // Utility output
  // ---------------------------
  formattaValuta(numero) {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(numero);
  }

  mostraRisultati(dati, tipo, situazione) {
    const container = document.getElementById('risultato');
    if (!container) return;

    let situazioneTesto = '';
    if (situazione.tredicesima) situazioneTesto += '• 13 mensilità<br>';
    if (situazione.partTime) situazioneTesto += `• Part-time ${situazione.percentualePartTime}%<br>`;
    if (situazione.regimeForfettario) situazioneTesto += '• Regime forfettario (5% INPS)<br>';
    if (situazione.conConiuge) situazioneTesto += '• Coniuge a carico<br>';
    if (situazione.numeroFigli > 0) {
      situazioneTesto += `• ${situazione.numeroFigli} figli (usati per detrazioni familiari semplificate)<br>`;
      if (situazione.figliSotto3Anni > 0) situazioneTesto += `• ${situazione.figliSotto3Anni} figli sotto i 3 anni<br>`;
      if (situazione.figliDisabili > 0) situazioneTesto += `• ${situazione.figliDisabili} figli con disabilità<br>`;
    }
    if (situazione.altriCarichi) situazioneTesto += '• Altri familiari a carico<br>';

    container.innerHTML = `
      <div class="risultato-dinamico">
        <div class="risultato-header">
          <h2> Calcolo stipendio netto 2025</h2>
          ${situazioneTesto ? `<div class="situazione-info">${situazioneTesto}</div>` : ''}
        </div>

        <!-- RIEPILOGO NETTO -->
        <div class="riepilogo-summary">
          <div class="summary-card">
            <div class="summary-label">Netto annuo</div>
            <div class="summary-value">${this.formattaValuta(dati.nettoAnnuale)}</div>
            <div class="summary-sub">Dopo INPS, IRPEF e addizionali</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Netto mensile</div>
            <div class="summary-value">${this.formattaValuta(dati.nettoMensile)}</div>
            <div class="summary-sub">Su ${dati.mensilita} mensilità</div>
          </div>
        </div>

        <!-- BLOCCO 1: RAL E MENSILITÀ -->
        <div class="calcolo-blocco">
          <h3>RAL e mensilità</h3>
          <div class="blocco-item">
            <div class="blocco-label">Retribuzione annua lorda (RAL)</div>
            <div class="blocco-valore">${this.formattaValuta(dati.RAL)}</div>
            <div class="blocco-dettaglio">Derivata dal lordo mensile e dalla configurazione delle mensilità</div>
          </div>
        </div>

        <!-- BLOCCO 2: CONTRIBUTI INPS -->
        <div class="calcolo-blocco">
          <h3>Contributi previdenziali (INPS)</h3>
          <div class="blocco-item">
            <div class="blocco-label">Contributi INPS lavoratore</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(dati.contributiINPS)}</div>
            <div class="blocco-dettaglio">9,19% RAL (oppure 5% per regime forfettario)</div>
          </div>
        </div>

        <!-- BLOCCO 3: BASE IMPONIBILE -->
        <div class="calcolo-blocco">
          <h3>Base imponibile IRPEF</h3>
          <div class="blocco-item">
            <div class="blocco-label">Reddito imponibile ai fini IRPEF</div>
            <div class="blocco-valore">${this.formattaValuta(dati.baseImponibileIRPEF)}</div>
            <div class="blocco-dettaglio">RAL − Contributi INPS lavoratore</div>
          </div>
        </div>

        <!-- BLOCCO 4: IRPEF LORDA -->
        <div class="calcolo-blocco">
          <h3>IRPEF lorda (3 scaglioni)</h3>
          <div class="blocco-item">
            <div class="blocco-label">IRPEF lorda</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(dati.irpefLorda)}</div>
            <div class="blocco-dettaglio">
              0–28.000€: 23% • 28.001–50.000€: 35% • oltre 50.000€: 43%
            </div>
          </div>
        </div>

        <!-- BLOCCO 5: DETRAZIONI -->
        <div class="calcolo-blocco">
          <h3>Detrazioni</h3>
          <div class="blocco-item">
            <div class="blocco-label">Detrazione per lavoro dipendente</div>
            <div class="blocco-valore" data-prefix="+">${this.formattaValuta(dati.detrazioniLavoro)}</div>
          </div>
          ${dati.detrazioniFamiliari > 0 ? `
            <div class="blocco-item">
              <div class="blocco-label">Detrazioni per familiari a carico</div>
              <div class="blocco-valore" data-prefix="+">${this.formattaValuta(dati.detrazioniFamiliari)}</div>
            </div>
          ` : ''}
          <div class="blocco-item">
            <div class="blocco-label">IRPEF netta</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(dati.irpefNetta)}</div>
            <div class="blocco-dettaglio">IRPEF lorda − detrazioni (mai negativa)</div>
          </div>
        </div>

        <!-- BLOCCO 6: ADDIZIONALI LOCALI -->
        <div class="calcolo-blocco">
          <h3>Addizionali regionali e comunali</h3>
          <div class="blocco-item">
            <div class="blocco-label">Addizionale regionale (1,73%)</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(dati.addizionali.regionale)}</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Addizionale comunale (0,80%)</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(dati.addizionali.comunale)}</div>
          </div>
        </div>

        <!-- BLOCCO 8: NETTO FINALE -->
        <div class="calcolo-blocco finale">
          <h3>Netto finale</h3>
          <div class="blocco-item finale">
            <div class="blocco-label">Netto annuo</div>
            <div class="blocco-valore finale">${this.formattaValuta(dati.nettoAnnuale)}</div>
          </div>

          <div class="riepilogo-mensile">
            <div class="mensile-item">
              <div class="mensile-label">Netto mensile (${tipo === 'annuale' ? 'medio' : 'calcolato'})</div>
              <div class="mensile-valore">${this.formattaValuta(dati.nettoMensile)}</div>
              <div class="mensile-dettaglio">Su ${dati.mensilita} mensilità</div>
            </div>
            ${situazione.tredicesima ? `
              <div class="mensile-item">
                <div class="mensile-label">Netto mensile con 13ª</div>
                <div class="mensile-valore">${this.formattaValuta(dati.nettoMensileCon13)}</div>
                <div class="mensile-dettaglio">Ripartito su 13 mensilità</div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- RIEPILOGO PERCENTUALE -->
        <div class="riepilogo-percentuale">
          <h4>📈 Riepilogo percentuale</h4>
          <div class="percentuali-grid">
            <div class="percentuale-item">
              <div class="percentuale-label">Incidenza IRPEF</div>
              <div class="percentuale-valore">${((dati.irpefNetta / dati.RAL) * 100).toFixed(1)}%</div>
            </div>
            <div class="percentuale-item">
              <div class="percentuale-label">Incidenza INPS</div>
              <div class="percentuale-valore">${((dati.contributiINPS / dati.RAL) * 100).toFixed(1)}%</div>
            </div>
            <div class="percentuale-item">
              <div class="percentuale-label">Incidenza addizionali</div>
              <div class="percentuale-valore">${(((dati.addizionali.regionale + dati.addizionali.comunale) / dati.RAL) * 100).toFixed(1)}%</div>
            </div>
            <div class="percentuale-item">
              <div class="percentuale-label">Rapporto netto / lordo</div>
              <div class="percentuale-valore" style="color:#16a34a;font-weight:700;">
                ${(dati.nettoAnnuale / dati.RAL * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <!-- NOTE -->
        <div class="note-mvp">
          <h4> Note 2025 </h4>
          <ul>
            <li>Le detrazioni per figli sono una semplificazione: l’HTML non distingue l’età, quindi si assume che i figli indicati siano a carico ai fini IRPEF.</li>
            <li>I figli under 21, nella realtà, sono coperti principalmente dall’Assegno Unico INPS (fuori busta paga).</li>
            <li>Valori per coniuge, figli e altri familiari sono forfettari e servono a dare un ordine di grandezza.</li>
            <li>Per un calcolo fiscale preciso in casi complessi è consigliato l’uso di un CAF o di un professionista.</li>
          </ul>
        </div>
      </div>
    `;
  }

  // ---------------------------
  // Pulsante "Pulisci"
  // ---------------------------
  setupPulisciButton() {
    const btnPulisci = document.getElementById('pulisci-campi');
    if (!btnPulisci) return;

    btnPulisci.addEventListener('click', () => {
      const lordo = document.getElementById('lordo');
      if (lordo) lordo.value = '';

      document.querySelectorAll('#calcolo-stipendio-form input[type="checkbox"]').forEach(cb => {
        cb.checked = cb.id === 'tredicesima';
      });

      document.querySelectorAll('#calcolo-stipendio-form input[type="number"]').forEach(input => {
        if (input.id === 'lordo') {
          input.value = '';
        } else if (input.id === 'percentualePartTime') {
          input.value = '100';
        } else {
          input.value = '0';
        }
      });

      const container = document.getElementById('risultato');
      if (container) {
        container.innerHTML = `
          <div class="result-placeholder">
            <h3>Pronto per il calcolo</h3>
            <p>Inserisci il tuo lordo mensile, configura le opzioni e premi “Calcola”.</p>
            <ul class="result-bullets">
              <li>Contributi INPS lavoratore: 9,19%</li>
              <li>Addizionali: Lombardia 1,73% + comune medio 0,80%</li>
              <li>IRPEF 2025: 3 scaglioni (23%, 35%, 43%)</li>
            </ul>
          </div>
        `;
      }
    });
  }
}

// ===============================
// Calcolatore Ferie
// ===============================

class CalcolatoreFerie {
  constructor() {
    this.initEventListeners();
  }

  initEventListeners() {
    const btnCalcola = document.getElementById('calcola-ferie');
    const btnPulisci = document.getElementById('pulisci-ferie');

    if (btnCalcola) {
      btnCalcola.addEventListener('click', () => this.calcolaFerie());
    }
    if (btnPulisci) {
      btnPulisci.addEventListener('click', () => this.pulisciFerie());
    }
  }

  getInputFerie() {
    const anno = parseInt(document.getElementById('annoRiferimento')?.value) || new Date().getFullYear();
    const monteAnnuale = parseFloat(document.getElementById('ferieMonteAnnuale')?.value) || 26;
    const partTime = document.getElementById('feriePartTime')?.checked || false;
    const percPartTime = parseFloat(document.getElementById('feriePercentualePartTime')?.value) || 100;
    const giorniSettimana = parseFloat(document.getElementById('giorniSettimana')?.value) || 5;
    const giorniLavorati = parseFloat(document.getElementById('giorniLavorati')?.value) || 0;
    const giorniPeriodo = parseFloat(document.getElementById('giorniPeriodo')?.value) || 365;
    const ferieUsate = parseFloat(document.getElementById('giorniFerieGiaUsate')?.value) || 0;

    return {
      anno,
      monteAnnuale,
      partTime,
      percPartTime,
      giorniSettimana,
      giorniLavorati,
      giorniPeriodo,
      ferieUsate
    };
  }

  calcolaFerie() {
    const dati = this.getInputFerie();

    if (dati.giorniLavorati <= 0 || dati.giorniPeriodo <= 0) {
      alert('⚠️ Inserisci giorni lavorati e giorni di periodo validi.');
      return;
    }

    // 1) Monte ferie annuo effettivo (ridotto per part-time)
    const fattorePartTime = dati.partTime ? (dati.percPartTime / 100) : 1;
    const ferieAnnueEffettive = dati.monteAnnuale * fattorePartTime;

    // 2) Rapporto tra giorni lavorati e periodo (proporzione)
    const quotaPeriodo = Math.min(1, dati.giorniLavorati / dati.giorniPeriodo);

    // 3) Ferie maturate nel periodo
    const ferieMaturate = ferieAnnueEffettive * quotaPeriodo;

    // 4) Ferie residue (non negative)
    const ferieResidue = Math.max(0, ferieMaturate - dati.ferieUsate);

    // 5) Conversione indicativa in ore (MVP: 8 ore = 1 giorno)
    const orePerGiorno = 8;
    const ferieMaturateOre = ferieMaturate * orePerGiorno;
    const ferieResidueOre = ferieResidue * orePerGiorno;

    this.mostraRisultatoFerie({
      ...dati,
      ferieAnnueEffettive,
      quotaPeriodo,
      ferieMaturate,
      ferieResidue,
      ferieMaturateOre,
      ferieResidueOre
    });
  }

  formattaNumero(n, dec = 2) {
    return n.toLocaleString('it-IT', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
  }

  mostraRisultatoFerie(d) {
    const container = document.getElementById('risultato-ferie');
    if (!container) return;

    const tipoRapporto = d.partTime
      ? `Part-time ${this.formattaNumero(d.percPartTime, 0)}%`
      : 'Full-time';

    container.innerHTML = `
      <div class="risultato-dinamico">
        <div class="risultato-header">
          <h2>🏖️ Calcolo ferie maturate ${d.anno}</h2>
          <div class="situazione-info">
            • ${tipoRapporto}<br>
            • Monte ferie contrattuale: ${this.formattaNumero(d.monteAnnuale, 1)} gg/anno<br>
            • Giorni lavorati nel periodo: ${this.formattaNumero(d.giorniLavorati, 0)} su ${this.formattaNumero(d.giorniPeriodo, 0)} gg<br>
            • Ferie già godute: ${this.formattaNumero(d.ferieUsate, 1)} gg
          </div>
        </div>

        <!-- RIEPILOGO -->
        <div class="riepilogo-summary">
          <div class="summary-card">
            <div class="summary-label">Ferie maturate</div>
            <div class="summary-value">${this.formattaNumero(d.ferieMaturate, 2)} gg</div>
            <div class="summary-sub">${this.formattaNumero(d.ferieMaturateOre, 1)} ore stimate</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Ferie residue</div>
            <div class="summary-value">${this.formattaNumero(d.ferieResidue, 2)} gg</div>
            <div class="summary-sub">${this.formattaNumero(d.ferieResidueOre, 1)} ore residue</div>
          </div>
        </div>

        <!-- DETTAGLIO CALCOLO -->
        <div class="calcolo-blocco">
          <h3>Monte ferie annuo effettivo</h3>
          <div class="blocco-item">
            <div class="blocco-label">Monte ferie da contratto</div>
            <div class="blocco-valore">${this.formattaNumero(d.monteAnnuale, 2)} gg</div>
            <div class="blocco-dettaglio">Valore indicato nel campo "Ferie annue previste dal contratto"</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Fattore part-time</div>
            <div class="blocco-valore">${this.formattaNumero(d.partTime ? d.percPartTime / 100 : 1, 2)}</div>
            <div class="blocco-dettaglio">1 = full-time; &lt;1 = riduzione per part-time</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Ferie annue effettive</div>
            <div class="blocco-valore">${this.formattaNumero(d.ferieAnnueEffettive, 2)} gg</div>
            <div class="blocco-dettaglio">Monte ferie annuo × fattore part-time</div>
          </div>
        </div>

        <div class="calcolo-blocco">
          <h3>Proporzione sul periodo</h3>
          <div class="blocco-item">
            <div class="blocco-label">Rapporto presenze / periodo</div>
            <div class="blocco-valore">${this.formattaNumero(d.quotaPeriodo * 100, 1)}%</div>
            <div class="blocco-dettaglio">Giorni lavorati ÷ giorni di calendario considerati</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Ferie maturate nel periodo</div>
            <div class="blocco-valore">${this.formattaNumero(d.ferieMaturate, 2)} gg</div>
            <div class="blocco-dettaglio">Ferie annue effettive × quota periodo</div>
          </div>
        </div>

        <div class="calcolo-blocco finale">
          <h3>Ferie residue</h3>
          <div class="blocco-item finale">
            <div class="blocco-label">Ferie residue</div>
            <div class="blocco-valore finale">${this.formattaNumero(d.ferieResidue, 2)} gg</div>
          </div>
          <div class="riepilogo-mensile">
            <div class="mensile-item">
              <div class="mensile-label">Residuo in ore (stima)</div>
              <div class="mensile-valore">${this.formattaNumero(d.ferieResidueOre, 1)} h</div>
              <div class="mensile-dettaglio">Calcolate con 8 ore per giorno di ferie</div>
            </div>
          </div>
        </div>

        <div class="note-mvp">
          <h4>📝 Note ferie</h4>
          <ul>
            <li>Il calcolo è proporzionale ai giorni lavorati sul periodo considerato.</li>
            <li>Il monte ferie annuo va verificato sul CCNL o sulla lettera di assunzione.</li>
            <li>La conversione in ore è indicativa (8 ore = 1 giorno).</li>
            <li>Non vengono gestiti ROL, ex-festività o regole specifiche del tuo contratto.</li>
          </ul>
        </div>
      </div>
    `;
  }

  pulisciFerie() {
    const form = document.getElementById('calcolo-ferie-form');
    if (!form) return;

    // Reset numerici
    document.getElementById('annoRiferimento').value = new Date().getFullYear();
    document.getElementById('ferieMonteAnnuale').value = 26;
    document.getElementById('feriePartTime').checked = false;
    document.getElementById('feriePercentualePartTime').value = 100;
    document.getElementById('giorniSettimana').value = 5;
    document.getElementById('giorniLavorati').value = 220;
    document.getElementById('giorniPeriodo').value = 365;
    document.getElementById('giorniFerieGiaUsate').value = 0;

    const container = document.getElementById('risultato-ferie');
    if (container) {
      container.innerHTML = `
        <div class="result-placeholder">
          <h3>Pronto per il calcolo ferie</h3>
          <p>Inserisci i giorni lavorati e il monte ferie annuo previsto dal contratto.</p>
          <ul class="result-bullets">
            <li>Monte ferie standard di default: 26 giorni/anno.</li>
            <li>Calcolo proporzionale in base alle presenze.</li>
            <li>Part-time gestito in percentuale.</li>
          </ul>
        </div>
      `;
    }
  }
}

// ===============================
// Calcolatore Tredicesima
// ===============================

class CalcolatoreTredicesima {
  constructor() {
    this.initEventListeners();
  }

  initEventListeners() {
    const btnCalcola = document.getElementById('calcola-tredicesima');
    const btnPulisci = document.getElementById('pulisci-tredicesima');

    if (btnCalcola) {
      btnCalcola.addEventListener('click', () => this.calcolaTredicesima());
    }
    if (btnPulisci) {
      btnPulisci.addEventListener('click', () => this.pulisciTredicesima());
    }
  }

  getInputTredicesima() {
    const lordoMensile = parseFloat(document.getElementById('tredicesimaLordoMensile')?.value) || 0;
    const mesiMaturati = parseFloat(document.getElementById('tredicesimaMesiMaturati')?.value) || 0;
    const mesiTotali = parseFloat(document.getElementById('tredicesimaMesiTotali')?.value) || 12;
    const partTime = document.getElementById('tredicesimaPartTime')?.checked || false;
    const percPartTime = parseFloat(document.getElementById('tredicesimaPercentualePartTime')?.value) || 100;
    const regimeForfettario = document.getElementById('tredicesimaRegimeForfettario')?.checked || false;

    return {
      lordoMensile,
      mesiMaturati,
      mesiTotali,
      partTime,
      percPartTime,
      regimeForfettario
    };
  }

  calcolaTredicesima() {
    const d = this.getInputTredicesima();

    if (!d.lordoMensile || d.lordoMensile <= 0) {
      alert('⚠️ Inserisci un lordo mensile di riferimento valido.');
      return;
    }
    if (d.mesiMaturati <= 0 || d.mesiTotali <= 0) {
      alert('⚠️ Inserisci mesi maturati e mesi totali validi.');
      return;
    }

    const fattorePartTime = d.partTime ? (d.percPartTime / 100) : 1;
    const quotaMesi = Math.min(1, d.mesiMaturati / d.mesiTotali);

    // 1) Tredicesima lorda teorica a tempo pieno
    const tredicesimaLordaPiena = d.lordoMensile;

    // 2) Tredicesima lorda effettiva (part-time + mesi)
    const tredicesimaLorda = tredicesimaLordaPiena * fattorePartTime * quotaMesi;

    // 3) Contributi INPS sulla tredicesima (MVP: stessa aliquota)
    const aliquotaINPS = d.regimeForfettario ? 0.05 : CONTRIBUTI_INPS;
    const inpsTredicesima = tredicesimaLorda * aliquotaINPS;

    const imponibileIRPEF = Math.max(0, tredicesimaLorda - inpsTredicesima);

    // 4) IRPEF sulla tredicesima (MVP: aliquota media 23% + detrazione forfettaria piccola)
    // Se volessi più precisione dovresti passargli la base annua, qui facciamo un approccio semplice.
    const aliquotaMedia = 0.23;
    let irpefLordaTredicesima = imponibileIRPEF * aliquotaMedia;

    // Piccola detrazione forfettaria sulla tredicesima, solo per redditi bassi
    let detrazioneTredicesima = 0;
    if (imponibileIRPEF <= 1500) {
      detrazioneTredicesima = 50;
    } else if (imponibileIRPEF <= 3000) {
      detrazioneTredicesima = 25;
    }

    const irpefNettaTredicesima = Math.max(0, irpefLordaTredicesima - detrazioneTredicesima);

    // 5) Netto tredicesima
    const tredicesimaNetta = tredicesimaLorda - inpsTredicesima - irpefNettaTredicesima;

    this.mostraRisultatoTredicesima({
      ...d,
      fattorePartTime,
      quotaMesi,
      tredicesimaLordaPiena,
      tredicesimaLorda,
      inpsTredicesima,
      imponibileIRPEF,
      irpefLordaTredicesima,
      detrazioneTredicesima,
      irpefNettaTredicesima,
      tredicesimaNetta
    });
  }

  formattaValuta(n) {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(n);
  }

  formattaNumero(n, dec = 2) {
    return n.toLocaleString('it-IT', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
  }

  mostraRisultatoTredicesima(d) {
    const container = document.getElementById('risultato-tredicesima');
    if (!container) return;

    const tipoRapporto = d.partTime
      ? `Part-time ${this.formattaNumero(d.percPartTime, 0)}%`
      : 'Full-time';

    const regime = d.regimeForfettario
      ? 'Regime forfettario (INPS 5% sulla tredicesima)'
      : 'Regime ordinario (INPS 9,19% sulla tredicesima)';

    container.innerHTML = `
      <div class="risultato-dinamico">
        <div class="risultato-header">
          <h2>🎁 Calcolo tredicesima</h2>
          <div class="situazione-info">
            • ${tipoRapporto}<br>
            • Mesi maturati: ${this.formattaNumero(d.mesiMaturati, 1)} su ${this.formattaNumero(d.mesiTotali, 1)}<br>
            • Lordo mensile di riferimento: ${this.formattaValuta(d.lordoMensile)}<br>
            • ${regime}
          </div>
        </div>

        <!-- RIEPILOGO -->
        <div class="riepilogo-summary">
          <div class="summary-card">
            <div class="summary-label">Tredicesima lorda</div>
            <div class="summary-value">${this.formattaValuta(d.tredicesimaLorda)}</div>
            <div class="summary-sub">Inclusi mesi maturati e part-time</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Tredicesima netta</div>
            <div class="summary-value">${this.formattaValuta(d.tredicesimaNetta)}</div>
            <div class="summary-sub">Dopo INPS e IRPEF stimata</div>
          </div>
        </div>

        <!-- DETTAGLIO LORDO -->
        <div class="calcolo-blocco">
          <h3>Tredicesima lorda</h3>
          <div class="blocco-item">
            <div class="blocco-label">Lordo mensile pieno</div>
            <div class="blocco-valore">${this.formattaValuta(d.tredicesimaLordaPiena)}</div>
            <div class="blocco-dettaglio">Mensilità lorda standard di riferimento</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Fattore part-time</div>
            <div class="blocco-valore">${this.formattaNumero(d.fattorePartTime, 2)}</div>
            <div class="blocco-dettaglio">1 = full-time, &lt;1 per part-time</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Quota mesi maturati</div>
            <div class="blocco-valore">${this.formattaNumero(d.quotaMesi * 100, 1)}%</div>
            <div class="blocco-dettaglio">Mesi maturati ÷ mesi totali considerati</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Tredicesima lorda effettiva</div>
            <div class="blocco-valore">${this.formattaValuta(d.tredicesimaLorda)}</div>
            <div class="blocco-dettaglio">Lordo mensile × fattore part-time × quota mesi</div>
          </div>
        </div>

        <!-- DETTAGLIO IMPOSTE -->
        <div class="calcolo-blocco">
          <h3>Contributi e IRPEF sulla tredicesima</h3>
          <div class="blocco-item">
            <div class="blocco-label">Contributi INPS sulla tredicesima</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(d.inpsTredicesima)}</div>
            <div class="blocco-dettaglio">Aliquota ${d.regimeForfettario ? '5%' : '9,19%'} applicata al lordo della tredicesima</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Imponibile IRPEF tredicesima</div>
            <div class="blocco-valore">${this.formattaValuta(d.imponibileIRPEF)}</div>
            <div class="blocco-dettaglio">Tredicesima lorda − INPS</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">IRPEF lorda stimata (23%)</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(d.irpefLordaTredicesima)}</div>
            <div class="blocco-dettaglio">Aliquota media del 23% sull'imponibile della tredicesima</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Detrazione sulla tredicesima</div>
            <div class="blocco-valore" data-prefix="+">${this.formattaValuta(d.detrazioneTredicesima)}</div>
            <div class="blocco-dettaglio">Piccola detrazione forfettaria per redditi più bassi</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">IRPEF netta sulla tredicesima</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(d.irpefNettaTredicesima)}</div>
            <div class="blocco-dettaglio">IRPEF lorda − detrazione (mai negativa)</div>
          </div>
        </div>

        <!-- RISULTATO -->
        <div class="calcolo-blocco finale">
          <h3>Risultato finale</h3>
          <div class="blocco-item finale">
            <div class="blocco-label">Tredicesima netta</div>
            <div class="blocco-valore finale">${this.formattaValuta(d.tredicesimaNetta)}</div>
          </div>
        </div>

        <div class="note-mvp">
          <h4>📝 Note tredicesima</h4>
          <ul>
            <li>L'IRPEF sulla tredicesima è calcolata con un'aliquota media (23%) e una detrazione forfettaria.</li>
            <li>Per un calcolo preciso dovrebbe essere considerato il reddito annuo complessivo.</li>
            <li>La logica è pensata per simulazioni veloci e confronti di massima.</li>
          </ul>
        </div>
      </div>
    `;
  }

  pulisciTredicesima() {
    document.getElementById('tredicesimaLordoMensile').value = '';
    document.getElementById('tredicesimaMesiMaturati').value = 12;
    document.getElementById('tredicesimaMesiTotali').value = 12;
    document.getElementById('tredicesimaPartTime').checked = false;
    document.getElementById('tredicesimaPercentualePartTime').value = 100;
    document.getElementById('tredicesimaRegimeForfettario').checked = false;

    const container = document.getElementById('risultato-tredicesima');
    if (container) {
      container.innerHTML = `
        <div class="result-placeholder">
          <h3>Pronto per il calcolo tredicesima</h3>
          <p>Inserisci il lordo mensile, i mesi maturati e premi “Calcola”.</p>
          <ul class="result-bullets">
            <li>Simulazione basata su aliquote IRPEF 2025 e INPS 9,19%.</li>
            <li>Mesi maturati / mesi totali determinano la quota di tredicesima.</li>
            <li>Part-time e regime forfettario incidono sul lordo e sui contributi.</li>
          </ul>
        </div>
      `;
    }
  }
}


// ===============================
// Calcolatore Straordinari
// ===============================

class CalcolatoreStraordinari {
  constructor() {
    this.initEventListeners();
  }

  initEventListeners() {
    const btnCalcola = document.getElementById('calcola-straordinari');
    const btnPulisci = document.getElementById('pulisci-straordinari');

    if (btnCalcola) {
      btnCalcola.addEventListener('click', () => this.calcolaStraordinari());
    }
    if (btnPulisci) {
      btnPulisci.addEventListener('click', () => this.pulisciStraordinari());
    }
  }

  getInputStraordinari() {
    const pagaOraria = parseFloat(document.getElementById('straordinariPagaOraria')?.value) || 0;

    const ore25 = parseFloat(document.getElementById('oreStraordinario25')?.value) || 0;
    const ore50 = parseFloat(document.getElementById('oreStraordinario50')?.value) || 0;
    const oreNotte = parseFloat(document.getElementById('oreStraordinarioNotturno')?.value) || 0;

    const perc25 = parseFloat(document.getElementById('percStraordinario25')?.value) || 0;
    const perc50 = parseFloat(document.getElementById('percStraordinario50')?.value) || 0;
    const percNotte = parseFloat(document.getElementById('percStraordinarioNotturno')?.value) || 0;

    const regimeForfettario = document.getElementById('straordinariRegimeForfettario')?.checked || false;
    const aliquotaMediaIrpef = (parseFloat(document.getElementById('aliquotaMediaStraordinari')?.value) || 23) / 100;

    return {
      pagaOraria,
      ore25,
      ore50,
      oreNotte,
      perc25,
      perc50,
      percNotte,
      regimeForfettario,
      aliquotaMediaIrpef
    };
  }

  calcolaStraordinari() {
    const d = this.getInputStraordinari();

    if (!d.pagaOraria || d.pagaOraria <= 0) {
      alert('⚠️ Inserisci una paga oraria lorda valida.');
      return;
    }

    const totaleOre = d.ore25 + d.ore50 + d.oreNotte;
    if (totaleOre <= 0) {
      alert('⚠️ Inserisci almeno alcune ore di straordinario.');
      return;
    }

    // 1) Calcolo lordo per fascia
    const coeff25 = 1 + d.perc25 / 100;
    const coeff50 = 1 + d.perc50 / 100;
    const coeffNotte = 1 + d.percNotte / 100;

    const lordo25 = d.ore25 * d.pagaOraria * coeff25;
    const lordo50 = d.ore50 * d.pagaOraria * coeff50;
    const lordoNotte = d.oreNotte * d.pagaOraria * coeffNotte;

    const lordoTotale = lordo25 + lordo50 + lordoNotte;

    // 2) Contributi INPS sugli straordinari
    const aliquotaINPS = d.regimeForfettario ? 0.05 : CONTRIBUTI_INPS;
    const inpsStraordinari = lordoTotale * aliquotaINPS;

    const imponibileIrpef = Math.max(0, lordoTotale - inpsStraordinari);

    // 3) IRPEF sugli straordinari (aliquota media selezionata)
    const irpefStraordinari = imponibileIrpef * d.aliquotaMediaIrpef;

    // 4) Netto straordinari
    const nettoStraordinari = lordoTotale - inpsStraordinari - irpefStraordinari;

    this.mostraRisultatoStraordinari({
      ...d,
      coeff25,
      coeff50,
      coeffNotte,
      lordo25,
      lordo50,
      lordoNotte,
      lordoTotale,
      inpsStraordinari,
      imponibileIrpef,
      irpefStraordinari,
      nettoStraordinari,
      totaleOre
    });
  }

  formattaValuta(n) {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(n);
  }

  formattaNumero(n, dec = 2) {
    return n.toLocaleString('it-IT', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
  }

  mostraRisultatoStraordinari(d) {
    const container = document.getElementById('risultato-straordinari');
    if (!container) return;

    const regime = d.regimeForfettario
      ? 'Regime forfettario (INPS 5% sugli straordinari)'
      : 'Regime ordinario (INPS 9,19% sugli straordinari)';

    container.innerHTML = `
      <div class="risultato-dinamico">
        <div class="risultato-header">
          <h2>⏰ Calcolo straordinari</h2>
          <div class="situazione-info">
            • Paga oraria lorda: ${this.formattaValuta(d.pagaOraria)}<br>
            • Ore totali di straordinario: ${this.formattaNumero(d.totaleOre, 2)} h<br>
            • IRPEF media applicata: ${this.formattaNumero(d.aliquotaMediaIrpef * 100, 1)}%<br>
            • ${regime}
          </div>
        </div>

        <!-- RIEPILOGO -->
        <div class="riepilogo-summary">
          <div class="summary-card">
            <div class="summary-label">Straordinario lordo</div>
            <div class="summary-value">${this.formattaValuta(d.lordoTotale)}</div>
            <div class="summary-sub">Somma di tutte le ore e maggiorazioni</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Straordinario netto</div>
            <div class="summary-value">${this.formattaValuta(d.nettoStraordinari)}</div>
            <div class="summary-sub">Dopo INPS e IRPEF stimata</div>
          </div>
        </div>

        <!-- DETTAGLIO LORDO PER FASCIA -->
        <div class="calcolo-blocco">
          <h3>Dettaglio straordinario lordo per fascia</h3>
          <div class="blocco-item">
            <div class="blocco-label">Feriali +${this.formattaNumero(d.perc25, 0)}%</div>
            <div class="blocco-valore">${this.formattaValuta(d.lordo25)}</div>
            <div class="blocco-dettaglio">
              ${this.formattaNumero(d.ore25, 2)} h × ${this.formattaValuta(d.pagaOraria)} × coeff. ${this.formattaNumero(d.coeff25, 2)}
            </div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Feriali +${this.formattaNumero(d.perc50, 0)}%</div>
            <div class="blocco-valore">${this.formattaValuta(d.lordo50)}</div>
            <div class="blocco-dettaglio">
              ${this.formattaNumero(d.ore50, 2)} h × ${this.formattaValuta(d.pagaOraria)} × coeff. ${this.formattaNumero(d.coeff50, 2)}
            </div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Notturno / festivo +${this.formattaNumero(d.percNotte, 0)}%</div>
            <div class="blocco-valore">${this.formattaValuta(d.lordoNotte)}</div>
            <div class="blocco-dettaglio">
              ${this.formattaNumero(d.oreNotte, 2)} h × ${this.formattaValuta(d.pagaOraria)} × coeff. ${this.formattaNumero(d.coeffNotte, 2)}
            </div>
          </div>
        </div>

        <!-- DETTAGLIO IMPOSTE -->
        <div class="calcolo-blocco">
          <h3>Contributi e IRPEF sugli straordinari</h3>
          <div class="blocco-item">
            <div class="blocco-label">Contributi INPS sugli straordinari</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(d.inpsStraordinari)}</div>
            <div class="blocco-dettaglio">Aliquota ${d.regimeForfettario ? '5%' : '9,19%'} applicata al totale straordinario lordo</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Imponibile IRPEF straordinari</div>
            <div class="blocco-valore">${this.formattaValuta(d.imponibileIrpef)}</div>
            <div class="blocco-dettaglio">Straordinario lordo − INPS</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">IRPEF sugli straordinari</div>
            <div class="blocco-valore" data-prefix="−">${this.formattaValuta(d.irpefStraordinari)}</div>
            <div class="blocco-dettaglio">Aliquota media ${this.formattaNumero(d.aliquotaMediaIrpef * 100, 1)}% sull’imponibile straordinari</div>
          </div>
        </div>

        <!-- RISULTATO FINALE -->
        <div class="calcolo-blocco finale">
          <h3>Risultato finale</h3>
          <div class="blocco-item finale">
            <div class="blocco-label">Straordinario netto complessivo</div>
            <div class="blocco-valore finale">${this.formattaValuta(d.nettoStraordinari)}</div>
          </div>
          <div class="riepilogo-mensile">
            <div class="mensile-item">
              <div class="mensile-label">Paga netta media per ora di straordinario</div>
              <div class="mensile-valore">
                ${this.formattaValuta(d.nettoStraordinari / d.totaleOre)}
              </div>
              <div class="mensile-dettaglio">Netto straordinari ÷ ore totali</div>
            </div>
          </div>
        </div>

        <div class="note-mvp">
          <h4>📝 Note straordinari</h4>
          <ul>
            <li>L'IRPEF è stimata con un'aliquota media scelta da te: non sostituisce il calcolo IRPEF annuale reale.</li>
            <li>Le maggiorazioni di contratto potrebbero essere diverse da 25/50/80%.</li>
            <li>Usa questo strumento per farti un’idea dell’ordine di grandezza degli straordinari netti.</li>
          </ul>
        </div>
      </div>
    `;
  }

  pulisciStraordinari() {
    document.getElementById('straordinariPagaOraria').value = '';
    document.getElementById('oreStraordinario25').value = 0;
    document.getElementById('oreStraordinario50').value = 0;
    document.getElementById('oreStraordinarioNotturno').value = 0;
    document.getElementById('percStraordinario25').value = 25;
    document.getElementById('percStraordinario50').value = 50;
    document.getElementById('percStraordinarioNotturno').value = 80;
    document.getElementById('straordinariRegimeForfettario').checked = false;
    document.getElementById('aliquotaMediaStraordinari').value = 23;

    const container = document.getElementById('risultato-straordinari');
    if (container) {
      container.innerHTML = `
        <div class="result-placeholder">
          <h3>Pronto per il calcolo straordinari</h3>
          <p>Inserisci paga oraria, ore straordinarie e maggiorazioni per stimare lordo e netto.</p>
          <ul class="result-bullets">
            <li>Le maggiorazioni sono configurabili per fascia (25%, 50%, notturno/festivo).</li>
            <li>IRPEF sugli straordinari stimata con una sola aliquota media.</li>
            <li>Contributi INPS su straordinari al 9,19% (o 5% se selezioni forfettario).</li>
          </ul>
        </div>
      `;
    }
  }
}


// ===============================
// Calcolatore Pensione (MVP)
// ===============================

class CalcolatorePensione {
  constructor() {
    this.initEventListeners();
  }

  initEventListeners() {
    const btnCalcola = document.getElementById('calcola-pensione');
    const btnPulisci = document.getElementById('pulisci-pensione');

    if (btnCalcola) {
      btnCalcola.addEventListener('click', () => this.calcolaPensione());
    }
    if (btnPulisci) {
      btnPulisci.addEventListener('click', () => this.pulisciPensione());
    }
  }

  getInputPensione() {
    const etaAttuale = parseFloat(document.getElementById('pensioneEtaAttuale')?.value) || 0;
    const etaUscita = parseFloat(document.getElementById('pensioneEtaUscita')?.value) || 0;
    const anniContribAttuali = parseFloat(document.getElementById('pensioneAnniContributiAttuali')?.value) || 0;
    const ralMedia = parseFloat(document.getElementById('pensioneRetribuzioneMedia')?.value) || 0;

    const aliquotaContributiva = (parseFloat(document.getElementById('pensioneAliquotaContributiva')?.value) || 33) / 100;
    const coeffSostituzione = (parseFloat(document.getElementById('pensioneCoeffSostituzione')?.value) || 70) / 100;
    const aliquotaMediaIrpef = (parseFloat(document.getElementById('pensioneAliquotaMediaIrpef')?.value) || 23) / 100;

    return {
      etaAttuale,
      etaUscita,
      anniContribAttuali,
      ralMedia,
      aliquotaContributiva,
      coeffSostituzione,
      aliquotaMediaIrpef
    };
  }

  calcolaPensione() {
    const d = this.getInputPensione();

    if (d.etaAttuale <= 0 || d.etaUscita <= d.etaAttuale) {
      alert('⚠️ Controlla età attuale e età di uscita (devono avere senso).');
      return;
    }
    if (!d.ralMedia || d.ralMedia <= 0) {
      alert('⚠️ Inserisci una retribuzione lorda annua media valida.');
      return;
    }

    const anniFuturi = Math.max(0, d.etaUscita - d.etaAttuale);
    const anniContribTotali = d.anniContribAttuali + anniFuturi;

    // 1) Montante contributivo stimato: RAL media × aliquota contributiva × anni totali
    const montanteContributivo = d.ralMedia * d.aliquotaContributiva * anniContribTotali;

    // 2) Pensione lorda annua semplificata:
    //    RAL media × coefficiente di sostituzione (es: 70% della RAL).
    const pensioneLordaAnnua = d.ralMedia * d.coeffSostituzione;

    // 3) Pensione netta annua (aliquota IRPEF media)
    const pensioneNettaAnnua = pensioneLordaAnnua * (1 - d.aliquotaMediaIrpef);

    // 4) Netti mensili (13 mensilità tipiche INPS)
    const pensioneNettaMensile = pensioneNettaAnnua / 13;

    this.mostraRisultatoPensione({
      ...d,
      anniFuturi,
      anniContribTotali,
      montanteContributivo,
      pensioneLordaAnnua,
      pensioneNettaAnnua,
      pensioneNettaMensile
    });
  }

  formattaValuta(n) {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(n);
  }

  formattaNumero(n, dec = 1) {
    return n.toLocaleString('it-IT', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
  }

  mostraRisultatoPensione(d) {
    const container = document.getElementById('risultato-pensione');
    if (!container) return;

    container.innerHTML = `
      <div class="risultato-dinamico">
        <div class="risultato-header">
          <h2>👵 Stima pensione</h2>
          <div class="situazione-info">
            • Età attuale: ${this.formattaNumero(d.etaAttuale, 0)} anni<br>
            • Età di uscita ipotizzata: ${this.formattaNumero(d.etaUscita, 0)} anni<br>
            • Anni di contributi attuali: ${this.formattaNumero(d.anniContribAttuali, 1)}<br>
            • Anni di contributi futuri stimati: ${this.formattaNumero(d.anniFuturi, 1)}<br>
            • RAL media lorda annua (fine carriera): ${this.formattaValuta(d.ralMedia)}
          </div>
        </div>

        <!-- RIEPILOGO -->
        <div class="riepilogo-summary">
          <div class="summary-card">
            <div class="summary-label">Pensione lorda annua</div>
            <div class="summary-value">${this.formattaValuta(d.pensioneLordaAnnua)}</div>
            <div class="summary-sub">Circa ${this.formattaNumero(d.coeffSostituzione * 100, 1)}% della RAL media</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Pensione netta mensile</div>
            <div class="summary-value">${this.formattaValuta(d.pensioneNettaMensile)}</div>
            <div class="summary-sub">Stimata su 13 mensilità</div>
          </div>
        </div>

        <!-- DETTAGLIO CONTRIBUTI -->
        <div class="calcolo-blocco">
          <h3>Anni di contributi e montante</h3>
          <div class="blocco-item">
            <div class="blocco-label">Anni totali di contributi</div>
            <div class="blocco-valore">${this.formattaNumero(d.anniContribTotali, 1)} anni</div>
            <div class="blocco-dettaglio">Anni già maturati + anni futuri fino all’età di uscita</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Aliquota contributiva media</div>
            <div class="blocco-valore">${this.formattaNumero(d.aliquotaContributiva * 100, 1)}%</div>
            <div class="blocco-dettaglio">Percentuale della retribuzione che finanzia il montante pensionistico</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Montante contributivo stimato</div>
            <div class="blocco-valore">${this.formattaValuta(d.montanteContributivo)}</div>
            <div class="blocco-dettaglio">RAL media × aliquota contributiva × anni totali</div>
          </div>
        </div>

        <!-- DETTAGLIO PENSIONE LORDA / NETTA -->
        <div class="calcolo-blocco">
          <h3>Pensione lorda e netta</h3>
          <div class="blocco-item">
            <div class="blocco-label">Coefficiente di sostituzione</div>
            <div class="blocco-valore">${this.formattaNumero(d.coeffSostituzione * 100, 1)}%</div>
            <div class="blocco-dettaglio">Quota della RAL media trasformata in pensione lorda</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Pensione lorda annua stimata</div>
            <div class="blocco-valore">${this.formattaValuta(d.pensioneLordaAnnua)}</div>
            <div class="blocco-dettaglio">RAL media × coefficiente di sostituzione</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Aliquota IRPEF media in pensione</div>
            <div class="blocco-valore">${this.formattaNumero(d.aliquotaMediaIrpef * 100, 1)}%</div>
            <div class="blocco-dettaglio">Stima di tassazione media sulla pensione</div>
          </div>
          <div class="blocco-item">
            <div class="blocco-label">Pensione netta annua stimata</div>
            <div class="blocco-valore">${this.formattaValuta(d.pensioneNettaAnnua)}</div>
            <div class="blocco-dettaglio">Pensione lorda × (1 − aliquota IRPEF media)</div>
          </div>
        </div>

        <!-- RISULTATO FINALE -->
        <div class="calcolo-blocco finale">
          <h3>Risultato finale</h3>
          <div class="blocco-item finale">
            <div class="blocco-label">Pensione netta mensile stimata</div>
            <div class="blocco-valore finale">${this.formattaValuta(d.pensioneNettaMensile)}</div>
          </div>
          <div class="riepilogo-mensile">
            <div class="mensile-item">
              <div class="mensile-label">Pensione netta annua</div>
              <div class="mensile-valore">${this.formattaValuta(d.pensioneNettaAnnua)}</div>
              <div class="mensile-dettaglio">Circa su 13 mensilità</div>
            </div>
          </div>
        </div>

        <div class="note-mvp">
          <h4>📝 Note pensione</h4>
          <ul>
            <li>Questa è una stima molto semplificata: non usa i coefficienti attuariali reali né le regole INPS aggiornate.</li>
            <li>Il coefficiente di sostituzione e l’aliquota IRPEF media sono volutamente regolabili per simulare scenari diversi.</li>
            <li>Per valutazioni reali è necessario usare il simulatore INPS o rivolgersi a un patronato.</li>
          </ul>
        </div>
      </div>
    `;
  }

  pulisciPensione() {
    document.getElementById('pensioneEtaAttuale').value = 35;
    document.getElementById('pensioneEtaUscita').value = 67;
    document.getElementById('pensioneAnniContributiAttuali').value = 10;
    document.getElementById('pensioneRetribuzioneMedia').value = '';

    document.getElementById('pensioneAliquotaContributiva').value = 33;
    document.getElementById('pensioneCoeffSostituzione').value = 70;
    document.getElementById('pensioneAliquotaMediaIrpef').value = 23;

    const container = document.getElementById('risultato-pensione');
    if (container) {
      container.innerHTML = `
        <div class="result-placeholder">
          <h3>Pronto per la stima pensione</h3>
          <p>Inserisci età, anni di contributi e una retribuzione lorda annua media di fine carriera.</p>
          <ul class="result-bullets">
            <li>La stima è puramente indicativa e molto semplificata.</li>
            <li>Non considera tutte le regole del sistema contributivo italiano.</li>
            <li>Per un conteggio ufficiale fare riferimento all’INPS o a un patronato.</li>
          </ul>
        </div>
      `;
    }
  }
}




// ===============================
// Inizializzazione pagina
// ===============================

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('calcolo-stipendio-form')) {
    new CalcolatoreStipendio();
  }

  if (document.getElementById('calcolo-ferie-form')) {
    new CalcolatoreFerie();
  }

  if (document.getElementById('calcolo-tredicesima-form')) {
    new CalcolatoreTredicesima();
  }

  if (document.getElementById('calcolo-straordinari-form')) {
    new CalcolatoreStraordinari();
  }

  if (document.getElementById('calcolo-pensione-form')) {
    new CalcolatorePensione();
  }

  // Cookie banner
  if (localStorage.getItem('cookies-accepted')) {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'none';
  }

  // Menu mobile
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
      });
    });
  }
});


// ===============================
// Funzioni cookie globali
// ===============================
function acceptCookies() {
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('cookies-accepted', 'true');
}

function rejectCookies() {
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('cookies-accepted', 'false');
}
