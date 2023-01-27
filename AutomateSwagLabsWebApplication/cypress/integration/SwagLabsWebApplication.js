/// <reference types="cypress">

//login to Swag Labs application
it('login to Swag Labs Application' , function(){
    cy.visit('https://www.saucedemo.com/')

    cy.get('#user-name').type('standard_user')
    cy.get('#password').type('secret_sauce')
    cy.get('#login-button').click()
})
//choose all products in home page
it('Choose all products' , function(){
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click()
    cy.get('[data-test="add-to-cart-sauce-labs-bike-light"]').click()
    cy.get('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]').click()
    cy.get('[data-test="add-to-cart-sauce-labs-fleece-jacket"]').click()
    cy.get('[data-test="add-to-cart-sauce-labs-onesie"]').click()
    cy.get('[data-test="add-to-cart-test.allthethings()-t-shirt-(red)"]').click()
})
//click nasket icone to move to checklist page
it('Move to checklist page' , function(){
    cy.scrollTo(0, -300)
    cy.wait(3000)
    cy.get('.shopping_cart_link').click()
})

//Logout from application
// it('Logout from app' , function(){
//     cy.get('#react-burger-menu-btn').click()  
//     cy.get('#logout_sidebar_link').click()
// })