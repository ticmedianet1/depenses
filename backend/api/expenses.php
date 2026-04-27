<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Gérer les requêtes OPTIONS (pre-flight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';
require_once '../models/Expense.php';

$database = new Database();
$db = $database->getConnection();
$expense = new Expense($db);

// Récupérer la méthode HTTP et l'action
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch($method) {
    case 'POST':
        // Recevoir les données de synchronisation
        $data = json_decode(file_get_contents("php://input"), true);
        
        if(isset($data['expenses']) && is_array($data['expenses'])) {
            // Synchronisation multiple
            $results = $expense->createMultiple($data['expenses']);
            
            if($results) {
                http_response_code(201);
                echo json_encode([
                    "success" => true,
                    "message" => "Synchronisation réussie",
                    "ids" => $results,
                    "count" => count($results)
                ]);
            } else {
                http_response_code(503);
                echo json_encode([
                    "success" => false,
                    "message" => "Erreur lors de la synchronisation"
                ]);
            }
        } 
        else if(isset($data['name'])) {
            // Ajout d'une seule dépense
            $expense->local_id = uniqid();
            $expense->name = $data['name'];
            $expense->amount = $data['amount'];
            $expense->date = $data['date'] ?? date('Y-m-d H:i:s');
            $expense->created_at = date('Y-m-d H:i:s');
            
            $id = $expense->create();
            
            if($id) {
                http_response_code(201);
                echo json_encode([
                    "success" => true,
                    "message" => "Dépense créée",
                    "id" => $id,
                    "local_id" => $expense->local_id
                ]);
            } else {
                http_response_code(503);
                echo json_encode([
                    "success" => false,
                    "message" => "Erreur lors de la création"
                ]);
            }
        }
        else {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Données invalides"
            ]);
        }
        break;
        
    case 'GET':
        if($action == 'stats') {
            // Récupérer les statistiques
            $stats = $expense->getStatsByMonth();
            $total = $expense->getTotal();
            
            echo json_encode([
                "success" => true,
                "total" => $total,
                "monthly_stats" => $stats
            ]);
        }
        else if($action == 'by_date' && isset($_GET['start']) && isset($_GET['end'])) {
            // Récupérer par période
            $expenses = $expense->readByDate($_GET['start'], $_GET['end']);
            echo json_encode([
                "success" => true,
                "expenses" => $expenses
            ]);
        }
        else {
            // Récupérer toutes les dépenses
            $expenses = $expense->readAll();
            echo json_encode([
                "success" => true,
                "expenses" => $expenses
            ]);
        }
        break;
        
    case 'PUT':
        // Mettre à jour une dépense
        $data = json_decode(file_get_contents("php://input"), true);
        
        if(isset($data['id'])) {
            $expense->id = $data['id'];
            $expense->name = $data['name'];
            $expense->amount = $data['amount'];
            $expense->date = $data['date'];
            
            if($expense->update()) {
                echo json_encode([
                    "success" => true,
                    "message" => "Dépense mise à jour"
                ]);
            } else {
                http_response_code(503);
                echo json_encode([
                    "success" => false,
                    "message" => "Erreur lors de la mise à jour"
                ]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ID manquant"]);
        }
        break;
        
    case 'DELETE':
        // Supprimer une dépense
        $data = json_decode(file_get_contents("php://input"), true);
        
        if(isset($data['id'])) {
            $expense->id = $data['id'];
            
            if($expense->delete()) {
                echo json_encode([
                    "success" => true,
                    "message" => "Dépense supprimée"
                ]);
            } else {
                http_response_code(503);
                echo json_encode([
                    "success" => false,
                    "message" => "Erreur lors de la suppression"
                ]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ID manquant"]);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode([
            "success" => false,
            "message" => "Méthode non autorisée"
        ]);
        break;
}
?>