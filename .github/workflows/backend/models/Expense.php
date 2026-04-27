<?php
class Expense {
    private $conn;
    private $table_name = "expenses";

    public $id;
    public $local_id;
    public $name;
    public $amount;
    public $date;
    public $synced;
    public $created_at;
    public $server_id;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Créer une nouvelle dépense
    public function create() {
        $query = "INSERT INTO " . $this->table_name . "
                  SET
                    local_id = :local_id,
                    name = :name,
                    amount = :amount,
                    date = :date,
                    synced = 1,
                    created_at = :created_at";

        $stmt = $this->conn->prepare($query);

        // Nettoyage des données
        $this->local_id = htmlspecialchars(strip_tags($this->local_id));
        $this->name = htmlspecialchars(strip_tags($this->name));
        $this->amount = htmlspecialchars(strip_tags($this->amount));
        $this->date = htmlspecialchars(strip_tags($this->date));
        $this->created_at = htmlspecialchars(strip_tags($this->created_at));

        // Binding des paramètres
        $stmt->bindParam(":local_id", $this->local_id);
        $stmt->bindParam(":name", $this->name);
        $stmt->bindParam(":amount", $this->amount);
        $stmt->bindParam(":date", $this->date);
        $stmt->bindParam(":created_at", $this->created_at);

        if($stmt->execute()) {
            return $this->conn->lastInsertId();
        }
        return false;
    }

    // Créer plusieurs dépenses (pour la synchronisation)
    public function createMultiple($expenses) {
        $results = [];
        
        $this->conn->beginTransaction();
        
        try {
            foreach($expenses as $expense) {
                $this->local_id = $expense['localId'];
                $this->name = $expense['name'];
                $this->amount = $expense['amount'];
                $this->date = $expense['date'];
                $this->created_at = $expense['createdAt'] ?? date('Y-m-d H:i:s');
                
                $serverId = $this->create();
                if($serverId) {
                    $results[$expense['localId']] = $serverId;
                }
            }
            
            $this->conn->commit();
            return $results;
            
        } catch(Exception $e) {
            $this->conn->rollBack();
            return false;
        }
    }

    // Récupérer toutes les dépenses
    public function readAll() {
        $query = "SELECT * FROM " . $this->table_name . " ORDER BY date DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    // Récupérer les dépenses par date
    public function readByDate($startDate, $endDate) {
        $query = "SELECT * FROM " . $this->table_name . "
                  WHERE date BETWEEN :start AND :end
                  ORDER BY date DESC";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":start", $startDate);
        $stmt->bindParam(":end", $endDate);
        $stmt->execute();
        
        return $stmt->fetchAll();
    }

    // Mettre à jour une dépense
    public function update() {
        $query = "UPDATE " . $this->table_name . "
                  SET
                    name = :name,
                    amount = :amount,
                    date = :date
                  WHERE id = :id";

        $stmt = $this->conn->prepare($query);

        $this->name = htmlspecialchars(strip_tags($this->name));
        $this->amount = htmlspecialchars(strip_tags($this->amount));
        $this->date = htmlspecialchars(strip_tags($this->date));
        $this->id = htmlspecialchars(strip_tags($this->id));

        $stmt->bindParam(":name", $this->name);
        $stmt->bindParam(":amount", $this->amount);
        $stmt->bindParam(":date", $this->date);
        $stmt->bindParam(":id", $this->id);

        if($stmt->execute()) {
            return true;
        }
        return false;
    }

    // Supprimer une dépense
    public function delete() {
        $query = "DELETE FROM " . $this->table_name . " WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        
        $this->id = htmlspecialchars(strip_tags($this->id));
        $stmt->bindParam(":id", $this->id);

        if($stmt->execute()) {
            return true;
        }
        return false;
    }

    // Obtenir le total des dépenses
    public function getTotal() {
        $query = "SELECT SUM(amount) as total FROM " . $this->table_name;
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $result = $stmt->fetch();
        return $result['total'] ?? 0;
    }

    // Obtenir les statistiques par mois
    public function getStatsByMonth() {
        $query = "SELECT 
                    DATE_FORMAT(date, '%Y-%m') as month,
                    COUNT(*) as count,
                    SUM(amount) as total
                  FROM " . $this->table_name . "
                  GROUP BY DATE_FORMAT(date, '%Y-%m')
                  ORDER BY month DESC
                  LIMIT 12";
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
?>