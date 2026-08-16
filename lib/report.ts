export type ProgressEntry = {
  id: string;
  time: string;
  text: string;
};

export type IncidentReport = {
  region: string;
  summary: string;
  ticket: string;
  occurTime: string;
  dispatchTime: string;
  pic: string;
  rootcause: string;
  cutPoint: string;
  progress: ProgressEntry[];
};

export const EMPTY_REPORT: IncidentReport = {
  region: '',
  summary: '',
  ticket: '',
  occurTime: '',
  dispatchTime: '',
  pic: '',
  rootcause: '',
  cutPoint: '',
  progress: [],
};

export const SAMPLE_REPORT: IncidentReport = {
  region: 'MANDAU',
  summary:
    'LINK DOWN AT DWDM UJB 109202_BANDUNG_PETA <> 100109_MAJALENGKA',
  ticket: 'INC-20260815-00016661',
  occurTime: '15/08/2026 13:54',
  dispatchTime: '15/08/2026 14:25',
  pic: 'Agus (Majalengka)',
  rootcause: 'Impact activity burning by resident',
  cutPoint: 'KM 22 from Majalengka',
  progress: [
    {
      id: 'p01',
      time: '14:30',
      text:
        'We Already Open TT MDU-20260815-0000036310 & Team prepare tools',
    },
    {
      id: 'p02',
      time: '15:00',
      text:
        'Team OTW last history KM 22 from Majalengka ETA 90 min',
    },
    {
      id: 'p03',
      time: '15:42',
      text:
        'Team partol on location found burnt cable, impact activity burning by resident, still waiting team jointer',
    },
    {
      id: 'p04',
      time: '16:22',
      text:
        'Team process striping cable existing side bandung, side majalengka condition area still burning',
    },
    {
      id: 'p05',
      time: '17:36',
      text: 'Progress Setting Closure side Bandung',
    },
    {
      id: 'p06',
      time: '18:59',
      text:
        'Condition cable side Majalengka has been extinguished, Team continue progress jumper cable',
    },
    {
      id: 'p07',
      time: '19:58',
      text: 'Progress Striping Cable side Majalengka',
    },
    {
      id: 'p08',
      time: '20:18',
      text: 'Progress Closure Setting side Majalengka',
    },
    {
      id: 'p09',
      time: '20:34',
      text: 'Progress Striping Cable Jumper side Bandung',
    },
    {
      id: 'p10',
      time: '20:56',
      text: 'Progress Closure Setting Both side',
    },
    {
      id: 'p11',
      time: '21:13',
      text: 'Progress Closure Splicing Side Majalengka',
    },
    {
      id: 'p12',
      time: '21:14',
      text: 'Progress Closure Splicing Side Bandung',
    },
    {
      id: 'p13',
      time: '22:01',
      text: 'Link already up.',
    },
  ],
};

export function formatReport(report: IncidentReport): string {
  const header =
    '*[' +
    report.region.trim() +
    '] ' +
    report.summary.trim() +
    ', [TT : ' +
    report.ticket.trim() +
    ']*';

  const progressLines = report.progress
    .filter((entry) => entry.time.trim() || entry.text.trim())
    .map((entry) =>
      (entry.time.trim() + ' ' + entry.text.trim()).trim()
    );

  return [
    header,
    'Occur Time = ' + report.occurTime.trim(),
    'Dispacth Time = ' + report.dispatchTime.trim(),
    'PIC = ' + report.pic.trim(),
    'Rootcause = ' + report.rootcause.trim(),
    'Cut Point = ' + report.cutPoint.trim(),
    '',
    'Update Progress  ',
    ...progressLines,
  ].join('\n');
}

export function completionScore(report: IncidentReport): number {
  const values = [
    report.region,
    report.summary,
    report.ticket,
    report.occurTime,
    report.dispatchTime,
    report.pic,
    report.rootcause,
    report.cutPoint,
  ];

  const filled = values.filter(
    (value) => value.trim().length > 0
  ).length;

  const hasProgress = report.progress.some(
    (entry) => entry.time.trim() && entry.text.trim()
  );

  return Math.round(
    ((filled + (hasProgress ? 1 : 0)) / 9) * 100
  );
}
