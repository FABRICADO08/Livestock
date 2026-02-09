/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/**
 *
 * @author 202002208
 */
public class Production {
    public int year =0, day=0;
    
    public int getYear(int year){
       this.year = year; 
       return year;
    }
    public void setYear(){
        this.year = year;
    }
    
    public int getDay(int day){
        this.day = day;
        return day;
    }
    public void setDay(){
        this.day = day;
    }
    
    public Production(int year ,int day){
       this.year = year;
       this.day = day;
       
    }
    
}
