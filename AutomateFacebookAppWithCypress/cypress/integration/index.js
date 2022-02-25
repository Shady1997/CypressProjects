/// <reference types="cypress">

//login to Facebook application
it('login to Facebook Application' , function(){
    cy.visit('https://www.facebook.com/')
    cy.get('[data-testid="royal_email"]').type('shadyahmed01091997@outlook.com')
    cy.get('[data-testid="royal_pass"]').type('P@ssw0rd')
    cy.get('[data-testid="royal_login_button"]').click()
})