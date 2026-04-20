<?php
require_once 'config.php';
checkAuth();

$pdo = getDB();

// Get filter parameters
$dateFrom = $_GET['date_from'] ?? date('Y-m-d');
$dateTo = $_GET['date_to'] ?? date('Y-m-d');
$status = $_GET['status'] ?? '';
$doctorId = $_GET['doctor_id'] ?? '';

// Validate dates
if (!strtotime($dateFrom) || !strtotime($dateTo)) {
    $dateFrom = date('Y-m-d');
    $dateTo = date('Y-m-d');
}

// Ensure date_from <= date_to
if (strtotime($dateFrom) > strtotime($dateTo)) {
    $temp = $dateFrom;
    $dateFrom = $dateTo;
    $dateTo = $temp;
}

// Build WHERE clause conditions
$whereConditions = ["a.appointment_date BETWEEN ? AND ?"];
$params = [$dateFrom, $dateTo];

if (!empty($status)) {
    $whereConditions[] = "a.appointment_status = ?";
    $params[] = $status;
}

if (!empty($doctorId)) {
    $whereConditions[] = "a.doctor_id = ?";
    $params[] = (int)$doctorId;
}

$whereClause = implode(' AND ', $whereConditions);

// Get today's date for comparison (if no filters, show today)
$today = date('Y-m-d');

// Total appointments with filters
$stmt = $pdo->prepare("
    SELECT COUNT(*) as total 
    FROM appointments a
    WHERE $whereClause
");
$stmt->execute($params);
$total = $stmt->fetch()['total'];

// Completed (only count if status filter is empty or set to COMPLETED)
$completedParams = [$dateFrom, $dateTo];
$completedWhere = "a.appointment_date BETWEEN ? AND ?";
if (!empty($doctorId)) {
    $completedWhere .= " AND a.doctor_id = ?";
    $completedParams[] = (int)$doctorId;
}
if (empty($status)) {
    $completedWhere .= " AND a.appointment_status = 'COMPLETED'";
} elseif ($status === 'COMPLETED') {
    $completedWhere .= " AND a.appointment_status = 'COMPLETED'";
} else {
    $completedParams = [];
}

if (!empty($completedParams)) {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count 
        FROM appointments a
        WHERE $completedWhere
    ");
    $stmt->execute($completedParams);
    $completed = $stmt->fetch()['count'];
} else {
    $completed = 0;
}

// Cancelled
$cancelledParams = [$dateFrom, $dateTo];
$cancelledWhere = "a.appointment_date BETWEEN ? AND ?";
if (!empty($doctorId)) {
    $cancelledWhere .= " AND a.doctor_id = ?";
    $cancelledParams[] = (int)$doctorId;
}
if (empty($status)) {
    $cancelledWhere .= " AND a.appointment_status = 'CANCELLED'";
} elseif ($status === 'CANCELLED') {
    $cancelledWhere .= " AND a.appointment_status = 'CANCELLED'";
} else {
    $cancelledParams = [];
}

if (!empty($cancelledParams)) {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count 
        FROM appointments a
        WHERE $cancelledWhere
    ");
    $stmt->execute($cancelledParams);
    $cancelled = $stmt->fetch()['count'];
} else {
    $cancelled = 0;
}

// No-show
$noShowParams = [$dateFrom, $dateTo];
$noShowWhere = "a.appointment_date BETWEEN ? AND ?";
if (!empty($doctorId)) {
    $noShowWhere .= " AND a.doctor_id = ?";
    $noShowParams[] = (int)$doctorId;
}
if (empty($status)) {
    $noShowWhere .= " AND a.appointment_status = 'NO_SHOW'";
} elseif ($status === 'NO_SHOW') {
    $noShowWhere .= " AND a.appointment_status = 'NO_SHOW'";
} else {
    $noShowParams = [];
}

if (!empty($noShowParams)) {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count 
        FROM appointments a
        WHERE $noShowWhere
    ");
    $stmt->execute($noShowParams);
    $noShow = $stmt->fetch()['count'];
} else {
    $noShow = 0;
}

// Doctor-wise breakdown
$doctorBreakdownParams = [$dateFrom, $dateTo];
$doctorBreakdownWhere = "a.appointment_date BETWEEN ? AND ?";
if (!empty($status)) {
    $doctorBreakdownWhere .= " AND a.appointment_status = ?";
    $doctorBreakdownParams[] = $status;
}
if (!empty($doctorId)) {
    $doctorBreakdownWhere .= " AND a.doctor_id = ?";
    $doctorBreakdownParams[] = (int)$doctorId;
}

$doctorBreakdownSql = "
    SELECT d.id, d.doctor_name, COUNT(a.id) as count
    FROM doctors d
    LEFT JOIN appointments a ON d.id = a.doctor_id AND ($doctorBreakdownWhere)
    WHERE d.is_active = 1
";
if (!empty($doctorId)) {
    $doctorBreakdownSql .= " AND d.id = ?";
    $doctorBreakdownParams[] = (int)$doctorId;
}
$doctorBreakdownSql .= " GROUP BY d.id, d.doctor_name ORDER BY d.doctor_name";

$stmt = $pdo->prepare($doctorBreakdownSql);
$stmt->execute($doctorBreakdownParams);
$doctorBreakdown = $stmt->fetchAll();

// Get list of all active doctors for filter dropdown
$stmt = $pdo->query("
    SELECT id, doctor_name 
    FROM doctors 
    WHERE is_active = 1 
    ORDER BY doctor_name
");
$doctorsList = $stmt->fetchAll();

// Time-slot utilization heatmap data (use date range from filters)
$startDate = $dateFrom;
$endDate = date('Y-m-d', strtotime($startDate . ' + 6 days'));

// Get all distinct time slots from doctor_slots table (source of truth)
$stmt = $pdo->prepare("
    SELECT DISTINCT TIME_FORMAT(start_time, '%H:00') as time_slot
    FROM doctor_slots
    WHERE slot_date BETWEEN ? AND ?
    ORDER BY time_slot
");
$stmt->execute([$startDate, $endDate]);
$timeSlots = $stmt->fetchAll();

// If no slots, try getting from appointments
if (empty($timeSlots)) {
    $stmt = $pdo->prepare("
        SELECT DISTINCT TIME_FORMAT(start_time, '%H:00') as time_slot
        FROM appointments
        WHERE appointment_date BETWEEN ? AND ?
        ORDER BY time_slot
    ");
    $stmt->execute([$startDate, $endDate]);
    $timeSlots = $stmt->fetchAll();
}

// If still no slots, use common time slots
if (empty($timeSlots)) {
    $commonSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '15:00'];
    $timeSlots = [];
    foreach ($commonSlots as $slot) {
        $timeSlots[] = ['time_slot' => $slot];
    }
}

// Get utilization data with filters
$utilizationParams = [$startDate, $endDate];
$utilizationWhere = "appointment_date BETWEEN ? AND ?";
if (!empty($status)) {
    $utilizationWhere .= " AND appointment_status = ?";
    $utilizationParams[] = $status;
} else {
    $utilizationWhere .= " AND appointment_status != 'CANCELLED'";
}
if (!empty($doctorId)) {
    $utilizationWhere .= " AND doctor_id = ?";
    $utilizationParams[] = (int)$doctorId;
}

$stmt = $pdo->prepare("
    SELECT 
        DATE(a.appointment_date) as appointment_date,
        TIME_FORMAT(a.start_time, '%H:00') as time_slot,
        p.patient_name,
        d.doctor_name,
        a.appointment_status
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d ON a.doctor_id = d.id
    WHERE $utilizationWhere
    ORDER BY a.appointment_date, a.start_time
");
$stmt->execute($utilizationParams);
$utilization = $stmt->fetchAll();

// Organize data by date and time
$utilizationMap = [];
foreach ($utilization as $row) {
    $date = $row['appointment_date'];
    $time = $row['time_slot'];
    if (!isset($utilizationMap[$date])) {
        $utilizationMap[$date] = [];
    }
    if (!isset($utilizationMap[$date][$time])) {
        $utilizationMap[$date][$time] = [
            'count' => 0,
            'appointments' => []
        ];
    }
    
    $utilizationMap[$date][$time]['count']++;
    $utilizationMap[$date][$time]['appointments'][] = [
        'patient_name' => $row['patient_name'],
        'doctor_name' => $row['doctor_name'],
        'status' => $row['appointment_status']
    ];
}

// Build heatmap data structure
$dates = [];
$currentDate = new DateTime($startDate);
$endDateTime = new DateTime($endDate);
while ($currentDate <= $endDateTime) {
    $dateStr = $currentDate->format('Y-m-d');
    $dates[] = $dateStr;
    $currentDate->modify('+1 day');
}

// Format time slots - extract time_slot values
$timeSlotList = [];
foreach ($timeSlots as $slot) {
    if (isset($slot['time_slot'])) {
        $timeSlotList[] = $slot['time_slot'];
    }
}

// Ensure we have at least some time slots
if (empty($timeSlotList)) {
    $timeSlotList = ['09:00', '10:00', '11:00', '12:00', '13:00', '15:00'];
}

$heatmapData = [
    'dates' => $dates,
    'timeSlots' => $timeSlotList,
    'utilization' => $utilizationMap
];

echo json_encode([
    'success' => true,
    'data' => [
        'stats' => [
            'total' => (int)$total,
            'completed' => (int)$completed,
            'cancelled' => (int)$cancelled,
            'noShow' => (int)$noShow
        ],
        'doctorBreakdown' => $doctorBreakdown,
        'heatmap' => $heatmapData,
        'doctorsList' => $doctorsList,
        'filters' => [
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
            'status' => $status,
            'doctorId' => $doctorId
        ],
        'currentDateTime' => [
            'date' => date('Y-m-d'),
            'time' => date('H:i:s'),
            'formatted' => date('F j, Y g:i A')
        ]
    ]
]);
?>