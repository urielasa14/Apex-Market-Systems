document.addEventListener('DOMContentLoaded', function () {
    initNavigation();
    initForms();
    initMenuToggle();
    loadDashboardData();
    setDefaultDate();
});


function showNotification(message, type) {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = 'notification ' + type;
    el.style.display = 'block';

    setTimeout(() => {
        el.style.display = 'none';
    }, 4000);
}


function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}


function setDefaultDate() {
    const dateInput = document.getElementById('pay-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
}


function initMenuToggle() {
    document.getElementById('menuToggle').addEventListener('click', function () {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('show');
        sidebar.classList.toggle('hidden');
    });
}


function initNavigation() {
    
    document.querySelectorAll('.nav-links li').forEach(function (link) {
        link.addEventListener('click', function () {
            const page = this.getAttribute('data-page');
            navigateTo(page);
        });
    });

    
    document.querySelectorAll('[data-navigate]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const page = this.getAttribute('data-navigate');
            navigateTo(page);
        });
    });
}

function navigateTo(pageId) {
    
    document.querySelectorAll('.page-view').forEach(function (page) {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
        
        void targetPage.offsetWidth;
        targetPage.classList.add('active');
    }

    
    document.querySelectorAll('.nav-links li').forEach(function (li) {
        li.classList.remove('active');
        if (li.getAttribute('data-page') === pageId) {
            li.classList.add('active');
        }
    });

    
    var titles = {
        'dashboard': 'Dashboard',
        'registration': 'Trader Registration',
        'payment': 'Payment',
        'report': 'Report'
    };
    document.getElementById('pageTitle').textContent = titles[pageId] || '';

    
    document.getElementById('notification').style.display = 'none';

    
    loadDashboardData();

    
    if (pageId === 'report') {
        setTimeout(renderCharts, 100);
    }

    
    var sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('show');
    }
}


function loadDashboardData() {
    fetch('api.php?action=get_dashboard')
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Server returned ' + response.status);
            }
            return response.json();
        })
        .then(function (result) {
            if (!result.success) {
                showNotification(result.message, 'error');
                return;
            }

            var data = result.data;

            
            document.getElementById('dash-total-traders').textContent = data.total_traders;
            document.getElementById('dash-total-dues').textContent = '$' + data.total_dues;
            document.getElementById('dash-stalls').textContent = data.stalls_occupied;

            
            document.getElementById('rep-traders').textContent = data.total_traders;
            document.getElementById('rep-dues').textContent = '$' + data.total_dues;

            
            document.getElementById('pay-total').textContent = '$' + data.total_dues;
            document.getElementById('pay-pending').textContent = data.pending_count;

            
            var paySelect = document.getElementById('pay-trader');
            var currentValue = paySelect.value;
            paySelect.innerHTML = '<option value="">-- Select Trader --</option>';
            data.trader_list.forEach(function (trader) {
                var option = document.createElement('option');
                option.value = trader.id;
                option.textContent = trader.name + ' (' + trader.stall_number + ')';
                paySelect.appendChild(option);
            });
            if (currentValue) {
                paySelect.value = currentValue;
            }

            
            var tbody = document.getElementById('activity-table');
            tbody.innerHTML = '';

            if (data.recent_activity.length === 0) {
                var emptyRow = document.createElement('tr');
                var emptyCell = document.createElement('td');
                emptyCell.colSpan = 4;
                emptyCell.textContent = 'No traders registered yet. Add a trader to get started.';
                emptyRow.appendChild(emptyCell);
                tbody.appendChild(emptyRow);
            } else {
                data.recent_activity.forEach(function (item) {
                    var row = document.createElement('tr');

                    var nameCell = document.createElement('td');
                    nameCell.textContent = item.name;

                    var stallCell = document.createElement('td');
                    stallCell.textContent = item.stall_number;

                    var statusCell = document.createElement('td');
                    var badge = document.createElement('span');
                    badge.textContent = item.status;
                    badge.className = 'status-badge ' + (item.status === 'Paid' ? 'status-paid' : 'status-pending');
                    statusCell.appendChild(badge);

                    var dateCell = document.createElement('td');
                    dateCell.textContent = item.last_payment;

                    row.appendChild(nameCell);
                    row.appendChild(stallCell);
                    row.appendChild(statusCell);
                    row.appendChild(dateCell);
                    tbody.appendChild(row);
                });
            }

            
            window.chartData = {
                weekly: data.weekly_chart,
                status: data.status_chart
            };
        })
        .catch(function (error) {
            console.error('Dashboard Load Error:', error);
            showNotification('Failed to connect to server. Is XAMPP running?', 'error');
        });
}


function clearErrors() {
    document.querySelectorAll('.field-error').forEach(function (el) {
        el.textContent = '';
    });
}

function showFieldError(fieldId, message) {
    var el = document.getElementById(fieldId);
    if (el) {
        el.textContent = message;
    }
}


function initForms() {
    
    document.getElementById('form-registration').addEventListener('submit', function (e) {
        e.preventDefault();
        clearErrors();

        var name = document.getElementById('reg-name').value.trim();
        var stall = document.getElementById('reg-stall').value.trim();
        var phone = document.getElementById('reg-phone').value.trim();
        var status = document.getElementById('reg-status').value;

        
        var isValid = true;
        if (name.length < 2) {
            showFieldError('err-name', 'Name must be at least 2 characters.');
            isValid = false;
        }
        if (stall === '') {
            showFieldError('err-stall', 'Stall number is required.');
            isValid = false;
        }
        if (phone.length < 5) {
            showFieldError('err-phone', 'Enter a valid phone number.');
            isValid = false;
        }
        if (!isValid) return;

        showLoading();

        var formData = new FormData();
        formData.append('name', name);
        formData.append('stall', stall);
        formData.append('phone', phone);
        formData.append('status', status);

        fetch('api.php?action=add_trader', {
            method: 'POST',
            body: formData
        })
            .then(function (response) { return response.json(); })
            .then(function (result) {
                hideLoading();
                if (result.success) {
                    showNotification(result.message, 'success');
                    document.getElementById('form-registration').reset();
                    loadDashboardData();
                } else {
                    showNotification(result.message, 'error');
                }
            })
            .catch(function (error) {
                hideLoading();
                console.error('Registration Error:', error);
                showNotification('Network error. Please try again.', 'error');
            });
    });

    
    document.getElementById('form-payment').addEventListener('submit', function (e) {
        e.preventDefault();
        clearErrors();

        var traderId = document.getElementById('pay-trader').value;
        var date = document.getElementById('pay-date').value;
        var amount = document.getElementById('pay-amount').value;
        var method = document.getElementById('pay-method').value;

        
        var isValid = true;
        if (!traderId) {
            showFieldError('err-trader', 'Please select a trader.');
            isValid = false;
        }
        if (!date) {
            showFieldError('err-date', 'Please select a date.');
            isValid = false;
        }
        if (!amount || parseFloat(amount) <= 0) {
            showFieldError('err-amount', 'Enter a valid amount.');
            isValid = false;
        }
        if (!method) {
            showFieldError('err-method', 'Please select a payment method.');
            isValid = false;
        }
        if (!isValid) return;

        showLoading();

        var formData = new FormData();
        formData.append('trader_id', traderId);
        formData.append('date', date);
        formData.append('amount', amount);
        formData.append('method', method);

        fetch('api.php?action=add_payment', {
            method: 'POST',
            body: formData
        })
            .then(function (response) { return response.json(); })
            .then(function (result) {
                hideLoading();
                if (result.success) {
                    showNotification(result.message, 'success');
                    document.getElementById('form-payment').reset();
                    setDefaultDate();
                    loadDashboardData();
                } else {
                    showNotification(result.message, 'error');
                }
            })
            .catch(function (error) {
                hideLoading();
                console.error('Payment Error:', error);
                showNotification('Network error. Please try again.', 'error');
            });
    });
}


var barChartInstance = null;
var pieChartInstance = null;

function renderCharts() {
    var weeklyData = (window.chartData && window.chartData.weekly) ? window.chartData.weekly : [0, 0, 0, 0];
    var statusData = (window.chartData && window.chartData.status) ? window.chartData.status : { Paid: 0, Pending: 0 };

    
    if (barChartInstance) barChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();

    
    var barCtx = document.getElementById('barChart').getContext('2d');
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Revenue ($)',
                data: weeklyData,
                backgroundColor: ['#3b49df', '#5b6abf', '#3b49df', '#5b6abf'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    
    var pieCtx = document.getElementById('pieChart').getContext('2d');
    pieChartInstance = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: ['Paid', 'Pending'],
            datasets: [{
                data: [statusData.Paid || 0, statusData.Pending || 0],
                backgroundColor: ['#3b49df', '#93c5fd'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}