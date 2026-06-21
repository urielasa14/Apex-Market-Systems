<?php

$action = isset($_GET['action']) ? $_GET['action'] : '';
if ($action !== 'export_csv') {
    header('Content-Type: application/json');
}


require_once 'db.php';


function sendResponse($success, $message, $data = null) {
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data"    => $data
    ]);
    exit();
}


function cleanInput($value) {
    return htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
}


if ($action === 'get_dashboard') {
    try {
        
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM traders");
        $totalTraders = $stmt->fetch()['count'];

        
        $stmt = $pdo->query("SELECT COALESCE(SUM(amount), 0) as total FROM payments");
        $totalDues = $stmt->fetch()['total'];

        
        $stmt = $pdo->query("SELECT COUNT(DISTINCT stall_number) as count FROM traders");
        $stallsOccupied = $stmt->fetch()['count'];

        
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM traders WHERE status = 'Pending'");
        $pendingCount = $stmt->fetch()['count'];

        
        $stmt = $pdo->query("
            SELECT 
                t.name, 
                t.stall_number, 
                t.status, 
                COALESCE(MAX(DATE_FORMAT(p.payment_date, '%d/%m/%Y')), 'No Payment') as last_payment
            FROM traders t 
            LEFT JOIN payments p ON t.id = p.trader_id 
            GROUP BY t.id, t.name, t.stall_number, t.status
            ORDER BY MAX(p.payment_date) DESC
            LIMIT 10
        ");
        $recentActivity = $stmt->fetchAll();

        
        $stmt = $pdo->query("SELECT id, name, stall_number FROM traders ORDER BY name ASC");
        $traderList = $stmt->fetchAll();

        
        $weeklyData = [];
        for ($i = 3; $i >= 0; $i--) {
            $stmt = $pdo->prepare("
                SELECT COALESCE(SUM(amount), 0) as total 
                FROM payments 
                WHERE YEARWEEK(payment_date, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL ? WEEK), 1)
            ");
            $stmt->execute([$i]);
            $weeklyData[] = (float) $stmt->fetch()['total'];
        }

        
        $stmt = $pdo->query("SELECT status, COUNT(*) as count FROM traders GROUP BY status");
        $statusData = ['Paid' => 0, 'Pending' => 0];
        while ($row = $stmt->fetch()) {
            $statusData[$row['status']] = (int) $row['count'];
        }

        sendResponse(true, "Dashboard data loaded", [
            "total_traders"   => (int) $totalTraders,
            "total_dues"      => number_format((float) $totalDues, 2),
            "stalls_occupied" => (int) $stallsOccupied,
            "pending_count"   => (int) $pendingCount,
            "recent_activity" => $recentActivity,
            "trader_list"     => $traderList,
            "weekly_chart"    => $weeklyData,
            "status_chart"    => $statusData
        ]);

    } catch (PDOException $e) {
        sendResponse(false, "Failed to load dashboard: " . $e->getMessage());
    }
}


elseif ($action === 'add_trader' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        
        $name   = cleanInput($_POST['name'] ?? '');
        $stall  = cleanInput($_POST['stall'] ?? '');
        $phone  = cleanInput($_POST['phone'] ?? '');
        $status = cleanInput($_POST['status'] ?? 'Pending');

        
        if (empty($name) || empty($stall) || empty($phone)) {
            sendResponse(false, "All fields are required.");
        }

        
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM traders WHERE stall_number = ?");
        $stmt->execute([$stall]);
        if ($stmt->fetch()['count'] > 0) {
            sendResponse(false, "Stall number '$stall' is already registered to another trader.");
        }

        
        $stmt = $pdo->prepare("INSERT INTO traders (name, stall_number, phone, status) VALUES (?, ?, ?, ?)");
        $stmt->execute([$name, $stall, $phone, $status]);

        sendResponse(true, "Trader '$name' registered successfully at $stall.");

    } catch (PDOException $e) {
        sendResponse(false, "Failed to add trader: " . $e->getMessage());
    }
}


elseif ($action === 'add_payment' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        
        $trader_id = intval($_POST['trader_id'] ?? 0);
        $amount    = floatval($_POST['amount'] ?? 0);
        $method    = cleanInput($_POST['method'] ?? '');
        $date      = cleanInput($_POST['date'] ?? '');

        
        if ($trader_id <= 0) {
            sendResponse(false, "Please select a valid trader.");
        }
        if ($amount <= 0) {
            sendResponse(false, "Amount must be greater than zero.");
        }
        if (empty($method)) {
            sendResponse(false, "Please select a payment method.");
        }
        if (empty($date)) {
            sendResponse(false, "Please enter a payment date.");
        }

        
        $stmt = $pdo->prepare("SELECT name FROM traders WHERE id = ?");
        $stmt->execute([$trader_id]);
        $trader = $stmt->fetch();
        if (!$trader) {
            sendResponse(false, "Trader not found.");
        }

        
        $stmt = $pdo->prepare("INSERT INTO payments (trader_id, amount, payment_method, payment_date) VALUES (?, ?, ?, ?)");
        $stmt->execute([$trader_id, $amount, $method, $date]);

        
        $stmt = $pdo->prepare("UPDATE traders SET status = 'Paid' WHERE id = ?");
        $stmt->execute([$trader_id]);

        sendResponse(true, "Payment of $" . number_format($amount, 2) . " recorded for " . $trader['name'] . ".");

    } catch (PDOException $e) {
        sendResponse(false, "Failed to add payment: " . $e->getMessage());
    }
}


elseif ($action === 'delete_trader' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $trader_id = intval($_POST['trader_id'] ?? 0);
        
        if ($trader_id <= 0) {
            sendResponse(false, "Invalid trader ID.");
        }

        $stmt = $pdo->prepare("DELETE FROM traders WHERE id = ?");
        $stmt->execute([$trader_id]);

        sendResponse(true, "Trader deleted successfully.");

    } catch (PDOException $e) {
        sendResponse(false, "Failed to delete trader: " . $e->getMessage());
    }
}


elseif ($action === 'export_csv') {
    try {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="apex_market_report_' . date('Y-m-d') . '.csv"');

        $output = fopen('php://output', 'w');
        
        
        fputcsv($output, ['Trader Name', 'Stall Number', 'Amount (Le)', 'Payment Method', 'Payment Date']);

        
        $stmt = $pdo->query("
            SELECT t.name, t.stall_number, p.amount, p.payment_method, p.payment_date 
            FROM payments p 
            JOIN traders t ON p.trader_id = t.id 
            ORDER BY p.payment_date DESC
        ");

        while ($row = $stmt->fetch()) {
            fputcsv($output, $row);
        }

        fclose($output);
        exit();

    } catch (PDOException $e) {
        header('Content-Type: application/json');
        sendResponse(false, "Failed to export CSV: " . $e->getMessage());
    }
}


elseif ($action === 'export_json') {
    try {
        $stmt = $pdo->query("
            SELECT t.name, t.stall_number, t.phone, p.amount, p.payment_method, p.payment_date 
            FROM payments p 
            JOIN traders t ON p.trader_id = t.id 
            ORDER BY p.payment_date DESC
        ");
        $data = $stmt->fetchAll();

        header('Content-Disposition: attachment; filename="apex_market_data_' . date('Y-m-d') . '.json"');
        echo json_encode(["system" => "Apex Market System", "exported" => date('Y-m-d H:i:s'), "records" => $data], JSON_PRETTY_PRINT);
        exit();

    } catch (PDOException $e) {
        sendResponse(false, "Failed to export JSON: " . $e->getMessage());
    }
}


else {
    sendResponse(false, "Invalid action or request method. Available actions: get_dashboard, add_trader, add_payment, delete_trader, export_csv, export_json");
}
?>